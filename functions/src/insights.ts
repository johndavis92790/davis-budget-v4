import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai'
import { assertAllowed } from './lib/auth'

const REGION = 'us-central1'
const PROJECT = 'davis-budget-v4'
const AI_LOCATION = 'global' // Gemini 3.x is only served from the global Vertex endpoint
const MODEL = 'gemini-3.5-flash-lite' // insights are a simple text task; the lite tier is enough

const SCHEMA = {
  type: Type.OBJECT,
  properties: {
    insights: { type: Type.ARRAY, items: { type: Type.STRING } },
  },
  required: ['insights'],
}

interface Summary {
  label: string
  totalSpent: number
  totalIncome: number
  net: number
  byCategory: { category: string; amount: number }[]
  byTag: { tag: string; amount: number }[]
  topExpenses: { description: string; category: string; amount: number; date: string }[]
  priorPeriodSpent?: number
  hsa?: { total: number; reimbursed: number; outstanding: number }
}

/**
 * Generates a handful of short spending observations from an already-
 * aggregated client-side summary — NOT raw transactions — so each call is a
 * small, cheap, single-turn request (no thinking, no large context).
 */
export const generateInsights = onCall(
  { region: REGION, timeoutSeconds: 30 },
  async (req) => {
    await assertAllowed(req)
    const summary = req.data as Summary
    if (!summary || typeof summary.totalSpent !== 'number') {
      throw new HttpsError('invalid-argument', 'Missing summary')
    }

    const ai = new GoogleGenAI({
      vertexai: true,
      project: PROJECT,
      location: AI_LOCATION,
    })

    const prompt = `You are a terse financial analyst for a family budget app. Given this JSON summary of their spending for "${summary.label}", write 3-4 short, specific, non-generic observations a person would actually find useful (e.g. notable concentrations, changes vs. the prior period, an unusually large single expense, HSA amounts still outstanding). Each under 20 words. No generic advice like "track your spending" or "consider a budget". If the data is too sparse for a real observation, say so briefly instead of inventing one.

${JSON.stringify(summary)}

Respond with only the JSON.`

    const response = await ai.models.generateContent({
      model: MODEL,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        responseMimeType: 'application/json',
        responseSchema: SCHEMA,
        temperature: 0.2,
        thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
      },
    })

    const text = response.text
    if (!text) throw new HttpsError('internal', 'No response from the model')
    try {
      return JSON.parse(text)
    } catch {
      throw new HttpsError('internal', 'Could not parse insights')
    }
  },
)
