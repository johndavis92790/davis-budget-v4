import {
  Baby,
  Shirt,
  Store,
  UtensilsCrossed,
  PartyPopper,
  Fuel,
  Gift,
  ShoppingCart,
  HeartPulse,
  Home,
  Briefcase,
  CircleHelp,
  Smartphone,
  PiggyBank,
  HandCoins,
  Plane,
  Car,
  type LucideIcon,
} from 'lucide-react'

export interface Category {
  name: string
  icon: LucideIcon
}

// The fixed household category set (matches v3).
export const CATEGORIES: Category[] = [
  { name: 'Children', icon: Baby },
  { name: 'Clothes', icon: Shirt },
  { name: 'Costco', icon: Store },
  { name: 'Dining', icon: UtensilsCrossed },
  { name: 'Fun', icon: PartyPopper },
  { name: 'Gas', icon: Fuel },
  { name: 'Gifts', icon: Gift },
  { name: 'Groceries', icon: ShoppingCart },
  { name: 'Health', icon: HeartPulse },
  { name: 'House', icon: Home },
  { name: 'Job', icon: Briefcase },
  { name: 'Other', icon: CircleHelp },
  { name: 'Phones', icon: Smartphone },
  { name: 'Savings', icon: PiggyBank },
  { name: 'Tithing', icon: HandCoins },
  { name: 'Travel', icon: Plane },
  { name: 'Vehicles', icon: Car },
]

export const CATEGORY_NAMES = CATEGORIES.map((c) => c.name)

const BY_NAME = new Map(CATEGORIES.map((c) => [c.name, c]))

export function categoryIcon(name: string): LucideIcon {
  return BY_NAME.get(name)?.icon ?? CircleHelp
}
