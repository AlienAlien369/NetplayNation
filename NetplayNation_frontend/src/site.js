import { Barbell, Basketball, Bicycle, Cricket, PersonSimpleRun, Racquet, SoccerBall, TennisBall, Trophy } from '@phosphor-icons/react';

export const SITE = {
  name: 'Netplay Nation',
  tagline: 'Gear up. Level up.',
  email: 'groverlakshya.25.lg@gmail.com',
  phone: '+91 88001 91819',
  city: 'Delhi, India',
};

export const CATEGORY_ICONS = {
  Badminton: Racquet,
  Cricket,
  Football: SoccerBall,
  Running: PersonSimpleRun,
  Fitness: Barbell,
  Tennis: TennisBall,
  Cycling: Bicycle,
  Basketball,
};
export const categoryIcon = (name) => CATEGORY_ICONS[name] || Trophy;

export const STATES = [
  'Andaman and Nicobar Islands', 'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chandigarh', 'Chhattisgarh',
  'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jammu and Kashmir',
  'Jharkhand', 'Karnataka', 'Kerala', 'Ladakh', 'Lakshadweep', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya',
  'Mizoram', 'Nagaland', 'Odisha', 'Puducherry', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura',
  'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
];

export const STATUS_LABEL = {
  pending_payment: 'Awaiting payment',
  placed: 'Order placed',
  packed: 'Packed',
  shipped: 'Shipped',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};
