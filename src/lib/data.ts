export const conversations = [
  { id: "design-team", name: "Design team", initials: "DT", color: "coral", preview: "Maya: The new flow looks great ✨", time: "2m", unread: 3, online: true },
  { id: "liam", name: "Liam Chen", initials: "LC", color: "blue", preview: "Let’s sync after lunch?", time: "18m", unread: 0, online: true },
  { id: "product-launch", name: "Product launch", initials: "PL", color: "violet", preview: "You: I’ve updated the timeline", time: "1h", unread: 0, online: false },
  { id: "amelia", name: "Amelia Hart", initials: "AH", color: "gold", preview: "Shared a document", time: "3h", unread: 0, online: false },
];

export const messages = [
  { mine: false, author: "Maya Rodriguez", initials: "MR", text: "Morning team! I’ve added the final screens for the onboarding flow.", time: "9:42 AM", color: "coral" },
  { mine: false, author: "Liam Chen", initials: "LC", text: "Just had a look — the progression feels much more natural now. Nice work!", time: "9:45 AM", color: "blue" },
  { mine: true, author: "You", initials: "AS", text: "Agreed. I especially like how the permission step is framed now. I’ll update the prototype links before our review.", time: "9:47 AM", color: "green" },
  { mine: false, author: "Maya Rodriguez", initials: "MR", text: "Perfect! The new flow looks great ✨", time: "9:49 AM", color: "coral" },
];

export const notifications = [
  { icon: "message", title: "Maya sent you a message", detail: "The new flow looks great ✨", time: "2 min ago", unread: true },
  { icon: "file", title: "Amelia shared a document", detail: "Q3 Product Strategy", time: "34 min ago", unread: true },
  { icon: "user", title: "Liam mentioned you", detail: "in Product launch", time: "1 hour ago", unread: false },
  { icon: "check", title: "Tracking session completed", detail: "Downtown delivery · 42 min", time: "Yesterday", unread: false },
];
