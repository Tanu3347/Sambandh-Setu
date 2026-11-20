import AsyncStorage from '@react-native-async-storage/async-storage';
import { request, USE_MOCK } from './api';
import { Profile } from './profileData';

const KEY = 'setu_profile';

const MOCK_STRINGS = new Set([
  'Master’s in Design',
  "Master's in Design",
  'Product Designer',
  'Curious, thoughtful, and happiest over a good book or a long walk.',
  '162 cm',
  'Aanya Sharma',
]);

function cleanMock(val?: string): string {
  if (!val || MOCK_STRINGS.has(val)) return '';
  return val;
}

export type SavedProfile = {
  name?: string; dob?: string; gender?: string; languages?: string[]; photoUri?: string;
  bio?: string; height?: string; education?: string; profession?: string; location?: string; age?: number;
};

export async function getMyProfile(): Promise<SavedProfile | null> {
  if (USE_MOCK) {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  }

  try {
    const res = await request<{ profile: any }>('/users/profile');
    const p = res.profile || {};
    const u = p.user || {};
    const remote: SavedProfile = {
      name: cleanMock(p.name || u.displayName || [u.firstName, u.lastName].filter(Boolean).join(' ') || u.username || ''),
      gender: p.gender && p.gender !== 'Not specified' ? p.gender : '',
      bio: cleanMock(p.bio) || '',
      education: cleanMock(p.education) || '',
      profession: cleanMock(p.profession) || '',
      height: p.heightCm ? `${p.heightCm} cm` : '',
      photoUri: p.avatarUrl || undefined,
      languages: p.interests || [],
      location: p.location || '',
      age: p.age || undefined,
    };
    await AsyncStorage.setItem(KEY, JSON.stringify(remote));
    return remote;
  } catch {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  }
}

// Merge the changed fields and sync with backend
export async function saveMyProfile(patch: Partial<SavedProfile>): Promise<void> {
  const backendPatch: any = {};
  if (patch.name !== undefined) backendPatch.name = patch.name;
  if (patch.bio !== undefined) backendPatch.bio = patch.bio;
  if (patch.education !== undefined) backendPatch.education = patch.education;
  if (patch.profession !== undefined) backendPatch.profession = patch.profession;
  if (patch.location !== undefined) backendPatch.location = patch.location;
  if (patch.photoUri !== undefined) backendPatch.avatarUrl = patch.photoUri;
  if (patch.gender !== undefined) backendPatch.gender = patch.gender;
  if (patch.height !== undefined) {
    const parsed = parseInt(String(patch.height), 10);
    if (!isNaN(parsed) && parsed >= 100 && parsed <= 250) {
      backendPatch.heightCm = parsed;
    }
  }

  if (!USE_MOCK && Object.keys(backendPatch).length > 0) {
    const res = await request<{ profile: any }>('/users/profile', {
      method: 'PATCH',
      body: JSON.stringify(backendPatch),
    });
    if (res?.profile) {
      const p = res.profile;
      const u = p.user || {};
      const confirmed: SavedProfile = {
        name: cleanMock(p.name || u.displayName || [u.firstName, u.lastName].filter(Boolean).join(' ') || u.username || ''),
        gender: p.gender && p.gender !== 'Not specified' ? p.gender : '',
        bio: cleanMock(p.bio) || '',
        education: cleanMock(p.education) || '',
        profession: cleanMock(p.profession) || '',
        height: p.heightCm ? `${p.heightCm} cm` : '',
        photoUri: p.avatarUrl || undefined,
        languages: p.interests || [],
        location: p.location || '',
        age: p.age || undefined,
      };
      await AsyncStorage.setItem(KEY, JSON.stringify(confirmed));
      return;
    }
  }

  const current = (await getMyProfile()) ?? {};
  const updated = { ...current, ...patch };
  await AsyncStorage.setItem(KEY, JSON.stringify(updated));
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
  const name = cleanMock(p?.name) || fallbackName;
  const age = ageFromDob(p?.dob) ?? p?.age ?? 0;
  return {
    name,
    age,
    gender: p?.gender && p?.gender !== 'Not specified' ? p?.gender : '',
    height: cleanMock(p?.height) || '',
    education: cleanMock(p?.education) || '',
    profession: cleanMock(p?.profession) || '',
    location: p?.location || '',
    bio: cleanMock(p?.bio) || '',
    about: [
      {
        title: 'Personal Details',
        rows: [
          { icon: 'person-outline', label: 'Name', value: name },
          { icon: 'transgender-outline', label: 'Gender', value: p?.gender && p?.gender !== 'Not specified' ? p?.gender : '' },
          { icon: 'location-outline', label: 'City', value: p?.location || '' },
          { icon: 'resize-outline', label: 'Height', value: cleanMock(p?.height) || '' },
          { icon: 'language-outline', label: 'Languages', value: p?.languages?.join(', ') || '' },
        ],
      },
      {
        title: 'Education & Career',
        rows: [
          { icon: 'school-outline', label: 'Education', value: cleanMock(p?.education) || '' },
          { icon: 'briefcase-outline', label: 'Profession', value: cleanMock(p?.profession) || '' },
        ],
      },
    ],
    lifestyle: [],
    family: [],
  };
}
