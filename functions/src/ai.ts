import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { GoogleGenAI, Type } from '@google/genai'
import { assertAllowed } from './lib/auth'
import { CATEGORY_NAMES } from './lib/categories'
import { denverToday } from './lib/fiscal'

const REGION = 'us-central1'
const PROJECT = 'davis-budget-v4'

const SCHEMA = {
  type: Type.OBJECT,
  properties: {
    type: { type: Type.STRING, enum: ['expense', 'income', 'refund'] },
    amount: { type: Type.NUMBER },
    date: { type: Type.STRING },
    category: { type: Type.STRING, enum: CATEGORY_NAMES },
    description: { type: Type.STRING },
    merchant: { type: Type.STRING },
    tags: { type: Type.ARRAY, items: { type: Type.STRING } },
    hsa: { type: Type.BOOLEAN },
    lineItems: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          description: { type: Type.STRING },
          amount: { type: Type.NUMBER },
          category: { type: Type.STRING, enum: CATEGORY_NAMES },
          hsa: { type: Type.BOOLEAN },
        },
        required: ['description', 'amount', 'category'],
      },
    },
  },
  required: ['type', 'amount', 'category', 'description'],
}

export const scanReceipt = onCall(
  { region: REGION, timeoutSeconds: 120, memory: '1GiB' },
  async (req) => {
    await assertAllowed(req)
    const data = req.data as { imageBase64?: string; mimeType?: string }
    if (!data.imageBase64 || !data.mimeType) {
      throw new HttpsError('invalid-argument', 'Missing image')
    }

    const ai = new GoogleGenAI({
      vertexai: true,
      project: PROJECT,
      location: REGION,
    })
    const today = denverToday()

    const prompt = `You extract structured data from a receipt or purchase screenshot for a family budget app. Today is ${today}.

Return JSON matching the provided schema:
- type: "expense" normally; "refund" if this is a return/refund; "income" if money was received.
- amount: the TOTAL paid as a positive number (grand total including tax), no currency symbol.
- date: the transaction date on the receipt as YYYY-MM-DD. If not visible, use ${today}.
- category: the single best fit from this exact list: ${CATEGORY_NAMES.join(', ')}. Guidance: Costco→"Costco", grocery stores→"Groceries", fuel→"Gas", restaurants/fast food→"Dining", pharmacy/medical/dental/vision→"Health", home goods→"House", phone/electronics→"Phones". If unsure use "Other".
- description: a short human description like "Smiths groceries" or "Chevron fuel".
- merchant: the store or vendor name.
- tags: 0-4 short tags (brand, store, or purpose), e.g. "Amazon", "Costco".
- hsa: true ONLY if this is a likely HSA-eligible medical expense (prescriptions, copays, medical supplies, dental, vision, clinics). Otherwise false.
- lineItems: include ONLY when the receipt spans MULTIPLE categories (e.g. a store run with both food and clothes), or mixes HSA-eligible with non-eligible items. Return ONE entry PER category group — NOT one per product. Each entry's amount is that group's combined subtotal INCLUDING its proportional share of tax/fees, so the lineItems amounts add up to the grand total. description briefly lists what's in that group (e.g. "Milk, bread, bananas"). If the whole receipt is a single category, return an empty array.

Respond with only the JSON.`

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          role: 'user',
          parts: [
            { text: prompt },
            { inlineData: { mimeType: data.mimeType, data: data.imageBase64 } },
          ],
        },
      ],
      config: {
        responseMimeType: 'application/json',
        responseSchema: SCHEMA,
        temperature: 0.1,
      },
    })

    const text = response.text
    if (!text) throw new HttpsError('internal', 'No response from the model')
    try {
      return JSON.parse(text)
    } catch {
      throw new HttpsError('internal', 'Could not parse the receipt')
    }
  },
)
