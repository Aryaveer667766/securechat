export const CREDENTIALS = [
  { username: 'aryaveer', id: 'aryaveer', password: 'arya@121', role: 'admin' },
  { username: 'guest', id: 'guest', password: 'guest@121', role: 'guest' }
];

// Unique prefix to avoid collisions on public PeerJS server
// Using v2 prefix to ensure fresh connections for deployment
const ID_PREFIX = 'secure-chat-v2-';

export const PEER_IDS = {
  'aryaveer': `${ID_PREFIX}aryaveer`,
  'guest': `${ID_PREFIX}guest`
};

export const TARGET_IDS = {
  'aryaveer': `${ID_PREFIX}guest`,
  'guest': `${ID_PREFIX}aryaveer`
};

export const PLACEHOLDER_AVATAR = "https://picsum.photos/200/200";