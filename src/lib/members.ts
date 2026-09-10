export const FAMILY_MEMBERS = [
	{ id: 'parent', name: 'Parent', emoji: '👩', color: '#7C3AED' },
	{ id: 'kid1', name: 'Kid 1', emoji: '🧒', color: '#2563EB' },
	{ id: 'kid2', name: 'Kid 2', emoji: '👧', color: '#EA580C' },
];

export function getMemberNameById(id: string): string {
	return (FAMILY_MEMBERS.find((m) => m.id === id) ?? { name: 'Someone' }).name;
}

export function getMemberEmojiById(id: string): string {
	return (FAMILY_MEMBERS.find((m) => m.id === id) ?? { emoji: '🧑' }).emoji;
}
