import AsyncStorage from '@react-native-async-storage/async-storage';
import { request, USE_MOCK } from './api';
import { Profile } from './profileData';

const KEY = 'setu_profile';

export type SavedProfile = {
  name?: string; dob?: string; gender?: string; languages?: string[]; photoUri?: string;
  bio?: string; height?: string; education?: string; profession?: string; location?: string;
};

export async function getMyProfile(): Promise<SavedProfile | null> {
  const raw = await AsyncStorage.getItem(KEY);
  const cached: SavedProfile | null = raw ? JSON.parse(raw) : null;

  if (USE_MOCK) return cached;

  try {
    const res = await request<{ profile: any }>('/users/profile');
    const p = res.profile || {};
    const u = p.user || {};
    const remote: SavedProfile = {
      name: u.displayName || [u.firstName, u.lastName].filter(Boolean).join(' ') || 'Aanya Sharma',
      gender: p.gender || 'Woman',
      bio: p.bio || '',
      education: p.education || '',
      profession: p.profession || '',
      height: p.heightCm ? `${p.heightCm} cm` : '',
      photoUri: p.avatarUrl || undefined,
      languages: p.interests || [],
      location: 'India',
    };
    const merged = { ...remote, ...(cached || {}) };
    await AsyncStorage.setItem(KEY, JSON.stringify(merged));
    return merged;
  } catch {
    return cached;
  }
}

// Merge the changed fields and sync with backend
export async function saveMyProfile(patch: Partial<SavedProfile>): Promise<void> {
  const current = (await getMyProfile()) ?? {};
  const updated = { ...current, ...patch };
  await AsyncStorage.setItem(KEY, JSON.stringify(updated));

  if (!USE_MOCK) {
    const backendPatch: any = {};
    if (patch.bio !== undefined) backendPatch.bio = patch.bio;
    if (patch.education !== undefined) backendPatch.education = patch.education;
    if (patch.profession !== undefined) backendPatch.profession = patch.profession;
    if (patch.photoUri !== undefined) backendPatch.avatarUrl = patch.photoUri;
    if (patch.gender !== undefined) backendPatch.gender = patch.gender;

    if (Object.keys(backendPatch).length > 0) {
      await request('/users/profile', {
        method: 'PATCH',
        body: JSON.stringify(backendPatch),
      }).catch((err) => console.warn('saveMyProfile remote sync notice:', err));
    }
  }
}

export function ageFromDob(dob?: string): number | null {
  if (!dob || dob.length !== 10) return null;
  const [d, m, y] = dob.split('/').map(Number);
  const now = new Date();
  let age = now.getFullYear() - y;
  if (now < new Date(now.getFullYear(), m - 1, d)) age -= 1;
  return age >= 0 ? age : null;
}

export async function buildOwnProfile(fallbackName: string): Promise<Profile> {
  const p = await getMyProfile();
  const none = 'Not added yet';
  const name = p?.name || fallbackName;
  return {
    name,
    age: ageFromDob(p?.dob) ?? 27,
    gender: p?.gender || 'Woman',
    height: p?.height || '162 cm',
    education: p?.education || 'Master’s in Design',
    profession: p?.profession || 'Product Designer',
    location: p?.location || 'Bengaluru',
    bio: p?.bio || 'Curious, thoughtful, and happiest over a good book or a long walk.',
    about: [
      {
        title: 'Personal Details',
        rows: [
          { icon: 'person-outline', label: 'Name', value: name },
          { icon: 'transgender-outline', label: 'Gender', value: p?.gender || 'Woman' },
          { icon: 'location-outline', label: 'City', value: p?.location || 'Bengaluru' },
          { icon: 'resize-outline', label: 'Height', value: p?.height || '162 cm' },
          { icon: 'language-outline', label: 'Languages', value: p?.languages?.join(', ') || 'English, Hindi' },
        ],
      },
      {
        title: 'Education & Career',
        rows: [
          { icon: 'school-outline', label: 'Education', value: p?.education || 'Master’s in Design' },
          { icon: 'briefcase-outline', label: 'Profession', value: p?.profession || 'Product Designer' },
        ],
      },
    ],
    lifestyle: [],
    family: [],
  };
}
