import { supabase, isSupabaseConfigured } from '../supabaseClient';
import { reportDataFailure } from './dataFailureBus';
import { uploadClinicalMedia, resolveMediaUrls } from './mediaStorage';
import { hashLocalPassword, verifyLocalPassword, isLegacyPasswordRecord } from './localPassword';

// --- MOCK OFFLINE DATABASE WITH LOCALSTORAGE ---
const getLocalUsers = () => JSON.parse(localStorage.getItem('irec_users') || '[]');
const saveLocalUsers = (users) => localStorage.setItem('irec_users', JSON.stringify(users));

const getLocalProfile = (userId) => {
  const data = localStorage.getItem(`irec_profile_${userId}`);
  if (data) return JSON.parse(data);
  
  // Fallback: see if it matches any user in irec_users
  const users = getLocalUsers();
  const user = users.find(u => u.id === userId);
  if (user) {
    const profile = {
      id: userId,
      role: user.role,
      name: user.name,
      email: user.email,
      crm: user.crm || '',
      specialty: user.specialty || '',
      rqe: user.rqe || '',
      birthDate: user.birthDate || '',
      gender: user.gender || '',
      healthUnit: '',
      hasDiabetes: false,
      hasHypertension: false,
      hasVenousInsufficiency: false,
      hasPeripheralArterialDisease: false,
      isSmoker: false,
      isObese: false,
      hasAmputationHistory: false,
      otherConditions: '',
      medications: '',
      allergies: '',
      attachedExams: [],
      triageAlerts: [],
      cpf: user.cpf || '',
      rg: user.rg || '',
      cns: user.cns || '',
      phone: user.phone || '',
      emergencyContactName: user.emergencyContactName || '',
      emergencyContactPhone: user.emergencyContactPhone || '',
      cep: user.cep || '',
      street: user.street || '',
      number: user.number || '',
      complement: user.complement || '',
      neighborhood: user.neighborhood || '',
      city: user.city || '',
      state: user.state || '',
      weight: user.weight || '',
      height: user.height || '',
      bloodType: user.bloodType || '',
      mobility: user.mobility || '',
      nutritionalStatus: user.nutritionalStatus || '',
      alcoholism: user.alcoholism || false,
      hasCaregiver: user.hasCaregiver || false,
      caregiverName: user.caregiverName || '',
      avatarUrl: user.avatarUrl || ''
    };
    saveLocalProfile(userId, profile);
    return profile;
  }
  return null;
};

const saveLocalProfile = (userId, profile) => {
  localStorage.setItem(`irec_profile_${userId}`, JSON.stringify(profile));
};

const getLocalEntries = (userId) => {
  const data = localStorage.getItem(`irec_entries_${userId}`);
  return data ? JSON.parse(data) : [];
};

const saveLocalEntries = (userId, entries) => {
  localStorage.setItem(`irec_entries_${userId}`, JSON.stringify(entries));
};

const getLocalAssignments = () => JSON.parse(localStorage.getItem('irec_assignments') || '[]');
const saveLocalAssignments = (assignments) => localStorage.setItem('irec_assignments', JSON.stringify(assignments));

// Helper to convert File object to Base64 (for local persistence)
const fileToBase64 = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.readAsDataURL(file);
  reader.onload = () => resolve(reader.result);
  reader.onerror = error => reject(error);
});

// Maximum file upload size (5MB)
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

const validateFileSize = (file) => {
  if (file && file.size > MAX_UPLOAD_BYTES) {
    throw new Error(`Arquivo muito grande (${(file.size / 1024 / 1024).toFixed(1)}MB). Limite máximo: 5MB.`);
  }
};

// Helper for LGPD sensitive media security (signed URLs with 15 minutes expiration)
export const getSecureMediaUrl = async (bucket, filePath, expiresIn = 900) => {
  if (!isSupabaseConfigured || !filePath) return filePath;
  try {
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(filePath, expiresIn);

    if (!error && data?.signedUrl) {
      return data.signedUrl;
    }
  } catch (e) {
    console.warn('[iRec] Fallback para public URL:', e);
  }
  const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(filePath);
  return publicUrl;
};

/**
 * Só perfil efetivamente verificado aparece em listagem de profissional.
 *
 * A condição anterior era:
 *
 *     p.verificationStatus === 'verified' || p.name?.toLowerCase().includes('teste')
 *
 * — qualquer perfil com "teste" no nome era exibido como profissional
 * verificado, em seis listagens diferentes. Resquício de QA em código de
 * produção: bastava cadastrar-se como "Dr. Teste" para constar como habilitado.
 */
const isVerifiedProfile = (p) => Boolean(p) && p.verificationStatus === 'verified';

// --- EXPORTED AUTHENTICATION API ---

// 1. Sign Up User (Patient or Doctor)
export const signUpUser = async (email, password, name, role, additionalData = {}) => {
  let verificationStatus = (role === 'doctor' || role === 'nurse' || additionalData.verificationStatus === 'pending') ? 'pending' : 'verified'; // Fixes IREC-0015

  if (!isSupabaseConfigured) {
    const users = getLocalUsers();
    if (users.some(u => u.email === email)) {
      throw new Error('Este e-mail já está cadastrado.');
    }
    const userId = `user_${Date.now()}`;
    // PBKDF2-SHA256 com sal por usuario. Antes era btoa(`irec_salt_${password}`),
    // que e Base64 — reversivel com atob() numa linha.
    const passwordHash = await hashLocalPassword(password);
    const newUser = { id: userId, email, passwordHash, name, role, ...additionalData };
    delete newUser.password;
    users.push(newUser);
    saveLocalUsers(users);
    
    // Create and save profile
    const profile = {
      id: userId,
      role: role,
      name: name,
      email: email,
      crm: additionalData.crm || '',
      specialty: additionalData.specialty || '',
      rqe: additionalData.rqe || '',
      cpf: additionalData.cpf || '',
      city: additionalData.city || '',
      state: additionalData.state || '',
      birthDate: additionalData.birthDate || '',
      gender: additionalData.gender || '',
      verificationStatus: verificationStatus,
      professionalDocumentUrl: additionalData.professionalDocumentUrl || '',
      healthUnit: additionalData.healthUnit || '',
      hasDiabetes: additionalData.hasDiabetes || false,
      hasHypertension: additionalData.hasHypertension || false,
      hasVenousInsufficiency: additionalData.hasVenousInsufficiency || false,
      hasPeripheralArterialDisease: additionalData.hasPeripheralArterialDisease || false,
      isSmoker: additionalData.isSmoker || false,
      isObese: additionalData.isObese || false,
      hasAmputationHistory: additionalData.hasAmputationHistory || false,
      otherConditions: additionalData.otherConditions || '',
      medications: additionalData.medications || '',
      allergies: additionalData.allergies || '',
      attachedExams: additionalData.attachedExams || [],
      triageAlerts: additionalData.triageAlerts || [],
      weight: additionalData.weight || '',
      height: additionalData.height || '',
      bloodType: additionalData.bloodType || '',
      mobility: additionalData.mobility || '',
      nutritionalStatus: additionalData.nutritionalStatus || '',
      alcoholism: additionalData.alcoholism || false,
      hasCaregiver: additionalData.hasCaregiver || false,
      caregiverName: additionalData.caregiverName || '',
      avatarUrl: additionalData.avatarUrl || ''
    };
    saveLocalProfile(userId, profile);
    localStorage.setItem('irec_active_user', JSON.stringify(profile));
    return profile;
  }

  // Supabase Auth
  try {
    const siteUrl = typeof window !== 'undefined' ? window.location.origin : 'https://irec-medical.vercel.app';
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: siteUrl,
        data: { 
          name, 
          role,
          crm: additionalData.crm || null,
          specialty: additionalData.specialty || null,
          rqe: additionalData.rqe || null,
          birthDate: additionalData.birthDate || null,
          gender: additionalData.gender || null
        }
      }
    });

    if (authError) throw authError;
    const user = authData.user;
    if (!user) throw new Error('Falha ao registrar usuário.');

    // Insert or update profile data (upsert to avoid conflict with database trigger)
    const payload = {
      id: user.id,
      role: role,
      name: name,
      email: email,
      crm: additionalData.crm || null,
      specialty: additionalData.specialty || null,
      rqe: additionalData.rqe || null,
      cpf: additionalData.cpf || null, // Fixes IREC-0112
      city: additionalData.city || null, // Fixes IREC-0112
      state: additionalData.state || null, // Fixes IREC-0112
      birth_date: additionalData.birthDate || null,
      gender: additionalData.gender || null,
      verification_status: verificationStatus,
      professional_document_url: additionalData.professionalDocumentUrl || null
    };

    const { error: profileError } = await supabase
      .from('clinical_profile')
      .upsert(payload);

    if (profileError) console.warn('[iRec] Aviso ao criar perfil no Supabase:', profileError.message);

    // If confirmation email is required by Supabase (authData.session is null)
    if (!authData.session) {
      throw new Error('CONFIRM_EMAIL');
    }

    // Return profile for direct login if email confirmation is disabled
    const profile = {
      id: user.id,
      role: role,
      name: name,
      email: email,
      crm: additionalData.crm || '',
      specialty: additionalData.specialty || '',
      rqe: additionalData.rqe || '',
      cpf: additionalData.cpf || '', // Fixes IREC-0112
      city: additionalData.city || '', // Fixes IREC-0112
      state: additionalData.state || '', // Fixes IREC-0112
      birthDate: additionalData.birthDate || '',
      gender: additionalData.gender || '',
      verificationStatus: verificationStatus,
      professionalDocumentUrl: additionalData.professionalDocumentUrl || ''
    };

    localStorage.setItem('irec_active_user', JSON.stringify(profile));
    saveLocalProfile(user.id, profile);
    return profile;
  } catch (err) {
    console.error('Erro no cadastro do Supabase:', err);
    throw err;
  }
};

// 2. Sign In User
export const signInUser = async (email, password) => {
  if (!isSupabaseConfigured) {
    const users = getLocalUsers();
    const candidato = users.find(u => u.email === email);

    // O `|| u.password === password` que havia aqui casava senha em texto puro.
    // E registro no formato antigo (Base64) e recusado de proposito: aceitar
    // manteria o furo aberto. Cadastro de contingencia pode ser refeito.
    if (candidato && isLegacyPasswordRecord(candidato.passwordHash)) {
      throw new Error(
        'Seu cadastro local usa um formato de senha inseguro que foi descontinuado. '
        + 'Refaca o cadastro neste dispositivo ou entre com a conta online.'
      );
    }

    const senhaOk = candidato
      ? await verifyLocalPassword(password, candidato.passwordHash)
      : false;

    if (!candidato || !senhaOk) {
      throw new Error('E-mail ou senha incorretos.');
    }
    const user = candidato;
    const profile = getLocalProfile(user.id);
    localStorage.setItem('irec_active_user', JSON.stringify(profile));
    return profile;
  }

  // Supabase Auth
  try {
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (authError) throw authError;
    const user = authData.user;
    if (!user) throw new Error('Falha ao autenticar.');

    const profile = await getClinicalProfile(user.id);
    if (profile) {
      localStorage.setItem('irec_active_user', JSON.stringify(profile));
    }
    return profile;
  } catch (err) {
    console.error('Erro no login do Supabase:', err);
    throw err;
  }
};

// 3. Sign Out User
export const signOutUser = async () => {
  localStorage.removeItem('irec_active_user');
  if (!isSupabaseConfigured) return true;
  
  try {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    return true;
  } catch (err) {
    console.error('Erro ao deslogar do Supabase:', err);
    return false;
  }
};

// 4. Get Current Authenticated User (on page reload)
export const getCurrentUser = async () => {
  if (!isSupabaseConfigured) {
    const data = localStorage.getItem('irec_active_user');
    return data ? JSON.parse(data) : null;
  }

  try {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) throw sessionError;
    if (!session || !session.user) return null;

    return await getClinicalProfile(session.user.id);
  } catch (err) {
    console.error('Erro ao verificar sessão no Supabase:', err);
    const data = localStorage.getItem('irec_active_user');
    return data ? JSON.parse(data) : null;
  }
};

// 4.1. Log Clinical Actions for Compliance (Audit Logs)
export const createAuditLog = async (action, targetId = null, details = {}) => {
  if (!isSupabaseConfigured) return null;
  
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session || !session.user) return null;
    
    const payload = {
      user_id: session.user.id,
      action: action,
      target_id: targetId,
      details: details
    };
    
    const { data, error } = await supabase
      .from('audit_logs')
      .insert(payload)
      .select()
      .single();
      
    if (error) throw error;
    return data;
  } catch (err) {
    console.error('Erro ao registrar log de auditoria no Supabase:', err);
    return null;
  }
};



// Cached auth session to avoid repeated getSession() calls
let _cachedSessionUserId = null;
if (isSupabaseConfigured && supabase) {
  supabase.auth.onAuthStateChange((_event, session) => {
    _cachedSessionUserId = session?.user?.id || null;
  });
  supabase.auth.getSession().then(({ data: { session } }) => {
    _cachedSessionUserId = session?.user?.id || null;
  });
}

const getActiveUserId = async () => {
  if (isSupabaseConfigured && _cachedSessionUserId) {
    return _cachedSessionUserId;
  }
  if (isSupabaseConfigured) {
    const { data: { session } } = await supabase.auth.getSession();
    if (session && session.user) {
      _cachedSessionUserId = session.user.id;
      return session.user.id;
    }
  }
  const active = localStorage.getItem('irec_active_user');
  return active ? JSON.parse(active).id : null;
};


// --- CLINICAL PROFILE & PATIENT LOGS ---

// 1. Fetch patient clinical profile
export const getClinicalProfile = async (userId = null) => {
  let resolvedId = userId;
  if (!resolvedId) {
    resolvedId = await getActiveUserId();
  }
  if (!resolvedId) return null;

  if (!isSupabaseConfigured) {
    return getLocalProfile(resolvedId);
  }
  
  try {
    const { data, error } = await supabase
      .from('clinical_profile')
      .select('*')
      .eq('id', resolvedId)
      .single();
      
    if (error) {
      if (error.code === 'PGRST116') {
        const { data: { session } } = await supabase.auth.getSession();
        if (session && session.user && session.user.id === resolvedId) {
          const user = session.user;
          const name = user.user_metadata?.full_name || user.user_metadata?.name || user.email.split('@')[0];
          
          // Check if a profile with this email already exists (e.g. pre-registered by doctor or offline)
          const { data: existingEmailProfile } = await supabase
            .from('clinical_profile')
            .select('*')
            .eq('email', user.email)
            .maybeSingle();

          if (existingEmailProfile) {
            // Update the existing profile's ID to the new authenticated user's ID
            const { error: updateError } = await supabase
              .from('clinical_profile')
              .update({ id: resolvedId })
              .eq('id', existingEmailProfile.id);
              
            if (!updateError) {
              const { data: newData, error: newError } = await supabase
                .from('clinical_profile')
                .select('*')
                .eq('id', resolvedId)
                .single();
                
              if (!newError && newData) {
                return {
                  id: newData.id,
                  role: newData.role,
                  name: newData.name,
                  email: newData.email,
                  crm: newData.crm || '',
                  specialty: newData.specialty || '',
                  rqe: newData.rqe || '',
                  birthDate: newData.birth_date || '',
                  gender: newData.gender || '',
                  healthUnit: newData.health_unit || '',
                  hasDiabetes: newData.has_diabetes,
                  hasHypertension: newData.has_hypertension,
                  hasVenousInsufficiency: newData.has_venous_insufficiency,
                  hasPeripheralArterialDisease: newData.has_peripheral_arterial_disease,
                  isSmoker: newData.is_smoker,
                  isObese: newData.is_obese,
                  hasAmputationHistory: newData.has_amputation_history,
                  otherConditions: newData.other_conditions || '',
                  medications: newData.medications || '',
                  allergies: newData.allergies || '',
                  attachedExams: newData.attached_exams || [],
                  triageAlerts: newData.triage_alerts || [],
                  cpf: newData.cpf || '',
                  rg: newData.rg || '',
                  cns: newData.cns || '',
                  phone: newData.phone || '',
                  emergencyContactName: newData.emergency_contact_name || '',
                  emergencyContactPhone: newData.emergency_contact_phone || '',
                  cep: newData.cep || '',
                  street: newData.street || '',
                  number: newData.number || '',
                  complement: newData.complement || '',
                  neighborhood: newData.neighborhood || '',
                  city: newData.city || '',
                  state: newData.state || '',
                  weight: newData.weight || '',
                  height: newData.height || '',
                  bloodType: newData.blood_type || '',
                  mobility: newData.mobility || '',
                  nutritionalStatus: newData.nutritional_status || '',
                  alcoholism: newData.alcoholism || false,
                  hasCaregiver: newData.has_caregiver || false,
                  caregiverName: newData.caregiver_name || '',
                  avatarUrl: newData.avatar_url || ''
                };
              }
            } else {
              console.error('Erro ao vincular perfil existente por e-mail:', updateError);
            }
          }

          // If no pre-existing profile, create a new one
          const payload = {
            id: user.id,
            role: 'patient',
            name: name,
            email: user.email,
            crm: null,
            specialty: null,
            rqe: null,
            birth_date: null,
            gender: null
          };
          
          const { error: insertError } = await supabase
            .from('clinical_profile')
            .insert(payload);
            
          if (!insertError) {
            const { data: newData, error: newError } = await supabase
              .from('clinical_profile')
              .select('*')
              .eq('id', resolvedId)
              .single();
              
            if (!newError && newData) {
              return {
                id: newData.id,
                role: newData.role,
                name: newData.name,
                email: newData.email,
                crm: newData.crm || '',
                specialty: newData.specialty || '',
                rqe: newData.rqe || '',
                birthDate: newData.birth_date || '',
                gender: newData.gender || '',
                healthUnit: newData.health_unit || '',
                hasDiabetes: newData.has_diabetes,
                hasHypertension: newData.has_hypertension,
                hasVenousInsufficiency: newData.has_venous_insufficiency,
                hasPeripheralArterialDisease: newData.has_peripheral_arterial_disease,
                isSmoker: newData.is_smoker,
                isObese: newData.is_obese,
                hasAmputationHistory: newData.has_amputation_history,
                otherConditions: newData.other_conditions || '',
                medications: newData.medications || '',
                allergies: newData.allergies || '',
                attachedExams: newData.attached_exams || [],
                triageAlerts: newData.triage_alerts || [],
                cpf: newData.cpf || '',
                rg: newData.rg || '',
                cns: newData.cns || '',
                phone: newData.phone || '',
                emergencyContactName: newData.emergency_contact_name || '',
                emergencyContactPhone: newData.emergency_contact_phone || '',
                cep: newData.cep || '',
                street: newData.street || '',
                number: newData.number || '',
                complement: newData.complement || '',
                neighborhood: newData.neighborhood || '',
                city: newData.city || '',
                state: newData.state || '',
                weight: newData.weight || '',
                height: newData.height || '',
                bloodType: newData.blood_type || '',
                mobility: newData.mobility || '',
                nutritionalStatus: newData.nutritional_status || '',
                alcoholism: newData.alcoholism || false,
                hasCaregiver: newData.has_caregiver || false,
                caregiverName: newData.caregiver_name || '',
                avatarUrl: newData.avatar_url || '',
                lastSeenAt: newData.last_seen_at || ''
              };
            }
          }
        }
      }
      throw error;
    }
    
    // Map snake_case columns to camelCase for frontend
    const resultProfile = {
      id: data.id,
      role: data.role,
      name: data.name,
      email: data.email,
      crm: data.crm || '',
      specialty: data.specialty || '',
      rqe: data.rqe || '',
      birthDate: data.birth_date || '',
      gender: data.gender || '',
      healthUnit: data.health_unit || '',
      hasDiabetes: data.has_diabetes,
      hasHypertension: data.has_hypertension,
      hasVenousInsufficiency: data.has_venous_insufficiency,
      hasPeripheralArterialDisease: data.has_peripheral_arterial_disease,
      isSmoker: data.is_smoker,
      isObese: data.is_obese,
      hasAmputationHistory: data.has_amputation_history,
      otherConditions: data.other_conditions || '',
      medications: data.medications || '',
      allergies: data.allergies || '',
      attachedExams: data.attached_exams || [],
      triageAlerts: data.triage_alerts || [],
      cpf: data.cpf || '',
      rg: data.rg || '',
      cns: data.cns || '',
      phone: data.phone || '',
      emergencyContactName: data.emergency_contact_name || '',
      emergencyContactPhone: data.emergency_contact_phone || '',
      cep: data.cep || '',
      street: data.street || '',
      number: data.number || '',
      complement: data.complement || '',
      neighborhood: data.neighborhood || '',
      city: data.city || '',
      state: data.state || '',
      weight: data.weight || '',
      height: data.height || '',
      bloodType: data.blood_type || '',
      mobility: data.mobility || '',
      nutritionalStatus: data.nutritional_status || '',
      alcoholism: data.alcoholism || false,
      hasCaregiver: data.has_caregiver || false,
      caregiverName: data.caregiver_name || '',
      avatarUrl: data.avatar_url || '',
      lastSeenAt: data.last_seen_at || '',
      bio: data.bio || '',
      education: data.education || '',
      consultationFee: data.consultation_fee ? parseFloat(data.consultation_fee) : null,
      verificationStatus: data.verification_status || 'unverified',
      professionalDocumentUrl: data.professional_document_url || ''
    };

    // Log view action if viewed by another user (e.g. doctor)
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session && session.user && session.user.id !== resolvedId) {
        createAuditLog('VIEW_PATIENT_RECORD', resolvedId, { patient_name: data.name });
      }
    } catch (auditErr) {
      console.warn('Erro ao disparar log de auditoria:', auditErr);
    }

    return resultProfile;
  } catch (err) {
    reportDataFailure('perfil clínico', err);
    return getLocalProfile(resolvedId);
  }
};

// 2. Update patient clinical profile
export const updateClinicalProfile = async (arg1, arg2 = null) => {
  let userId, profile;
  if (arg2 !== null) {
    userId = arg1;
    profile = arg2;
  } else {
    profile = arg1;
    userId = profile.id;
  }

  if (!userId) {
    userId = await getActiveUserId();
  }
  if (!userId) return null;

  if (!isSupabaseConfigured) {
    saveLocalProfile(userId, profile);
    // If the active user profile was updated, sync it
    const active = localStorage.getItem('irec_active_user');
    if (active) {
      const activeObj = JSON.parse(active);
      if (activeObj.id === userId) {
        localStorage.setItem('irec_active_user', JSON.stringify(profile));
      }
    }
    return profile;
  }

  try {
    const payload = {
      name: profile.name,
      birth_date: profile.birthDate,
      gender: profile.gender,
      health_unit: profile.healthUnit,
      has_diabetes: profile.hasDiabetes,
      has_hypertension: profile.hasHypertension,
      has_venous_insufficiency: profile.hasVenousInsufficiency,
      has_peripheral_arterial_disease: profile.hasPeripheralArterialDisease,
      is_smoker: profile.isSmoker,
      is_obese: profile.isObese,
      has_amputation_history: profile.hasAmputationHistory,
      other_conditions: profile.otherConditions,
      medications: profile.medications,
      allergies: profile.allergies,
      attached_exams: profile.attachedExams,
      triage_alerts: profile.triageAlerts,
      crm: profile.crm || null,
      specialty: profile.specialty || null,
      rqe: profile.rqe || null,
      cpf: profile.cpf || null,
      rg: profile.rg || null,
      cns: profile.cns || null,
      phone: profile.phone || null,
      emergency_contact_name: profile.emergencyContactName || null,
      emergency_contact_phone: profile.emergencyContactPhone || null,
      cep: profile.cep || null,
      street: profile.street || null,
      number: profile.number || null,
      complement: profile.complement || null,
      neighborhood: profile.neighborhood || null,
      city: profile.city || null,
      state: profile.state || null,
      weight: profile.weight || null,
      height: profile.height || null,
      blood_type: profile.bloodType || null,
      mobility: profile.mobility || null,
      nutritional_status: profile.nutritionalStatus || null,
      alcoholism: profile.alcoholism || false,
      has_caregiver: profile.hasCaregiver || false,
      caregiver_name: profile.caregiverName || null,
      avatar_url: profile.avatarUrl || null,
      bio: profile.bio || null,
      education: profile.education || null,
      consultation_fee: profile.consultationFee || null
    };

    const { error } = await supabase
      .from('clinical_profile')
      .update(payload)
      .eq('id', userId);

    if (error) throw error;
    
    // Always sync local profile cache so data doesn't revert on refresh/navigation
    saveLocalProfile(userId, profile);
    const active = localStorage.getItem('irec_active_user');
    if (active) {
      try {
        const activeObj = JSON.parse(active);
        if (activeObj.id === userId) {
          localStorage.setItem('irec_active_user', JSON.stringify(profile));
        }
      } catch (e) {
        console.warn('Erro ao atualizar usuário ativo no localStorage:', e);
      }
    }

    // Log audit log
    createAuditLog('UPDATE_CLINICAL_PROFILE', userId, { fields_updated: Object.keys(payload) });

    return profile;
  } catch (err) {
    console.error('Erro ao atualizar perfil no Supabase:', err);
    saveLocalProfile(userId, profile);
    const active = localStorage.getItem('irec_active_user');
    if (active) {
      try {
        const activeObj = JSON.parse(active);
        if (activeObj.id === userId) {
          localStorage.setItem('irec_active_user', JSON.stringify(profile));
        }
      } catch (e) {
        console.warn('Erro ao atualizar usuário ativo no localStorage:', e);
      }
    }
    return profile;
  }
};

// 2.2. Upload user avatar (photo) to Supabase Storage or Local Storage
export const uploadAvatar = async (userId, file) => {
  let resolvedId = userId;
  if (!resolvedId) {
    resolvedId = await getActiveUserId();
  }
  if (!resolvedId) return null;

  if (!isSupabaseConfigured) {
    try {
      const base64 = await fileToBase64(file);
      const profile = getLocalProfile(resolvedId);
      if (profile) {
        profile.avatarUrl = base64;
        saveLocalProfile(resolvedId, profile);
        const active = localStorage.getItem('irec_active_user');
        if (active) {
          const activeObj = JSON.parse(active);
          if (activeObj.id === resolvedId) {
            localStorage.setItem('irec_active_user', JSON.stringify(profile));
          }
        }
      }
      return base64;
    } catch (e) {
      console.error('Erro no fallback do avatar:', e);
      return null;
    }
  }

  try {
    validateFileSize(file);
    const fileExt = file.name.split('.').pop();
    const fileName = `${resolvedId}_avatar_${Date.now()}.${fileExt}`;
    const filePath = `${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(filePath, file, {
        upsert: true,
        cacheControl: '3600'
      });

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage
      .from('avatars')
      .getPublicUrl(filePath);

    // Fetch original profile first to make sure we preserve local representation
    const profile = await getClinicalProfile(resolvedId);
    if (profile) {
      profile.avatarUrl = publicUrl;
      const { error: updateError } = await supabase
        .from('clinical_profile')
        .update({ avatar_url: publicUrl })
        .eq('id', resolvedId);
      if (updateError) throw updateError;
      
      // Update local copy too
      saveLocalProfile(resolvedId, profile);
      const active = localStorage.getItem('irec_active_user');
      if (active) {
        const activeObj = JSON.parse(active);
        if (activeObj.id === resolvedId) {
          localStorage.setItem('irec_active_user', JSON.stringify(profile));
        }
      }
    }

    return publicUrl;
  } catch (err) {
    console.error('Erro ao fazer upload do avatar:', err);
    try {
      const base64 = await fileToBase64(file);
      const profile = getLocalProfile(resolvedId);
      if (profile) {
        profile.avatarUrl = base64;
        saveLocalProfile(resolvedId, profile);
      }
      return base64;
    } catch {
      return null;
    }
  }
};

// 3. Fetch wound entries history for a patient
export const getWoundEntries = async (patientId = null) => {
  let resolvedId = patientId;
  if (!resolvedId) {
    resolvedId = await getActiveUserId();
  }
  if (!resolvedId) return [];

  if (!isSupabaseConfigured) {
    return getLocalEntries(resolvedId);
  }

  try {
    const { data, error } = await supabase
      .from('wound_entries')
      .select('*, wound_entry_attachments(*)')
      .eq('patient_id', resolvedId)
      // Ordena por data real. Antes era so por `id`, que funcionava por acaso e
      // quebraria com qualquer importacao fora de ordem. `entry_date` pode ser
      // nulo em registro antigo, entao `id` fica como desempate.
      .order('entry_date', { ascending: true, nullsFirst: true })
      .order('id', { ascending: true });

    if (error) throw error;

    const entries = data.map(item => ({
      id: item.id,
      patientId: item.patient_id,
      date: item.date,
      type: item.type,
      appearanceDate: item.appearance_date || '',
      anatomicalLocation: item.anatomical_location || '',
      lesionStage: item.lesion_stage || '',
      pain: item.pain,
      exudate: item.exudate,
      odor: item.odor,
      localTemperature: item.local_temperature || '',
      infectionSigns: item.infection_signs || '',
      appliedDressing: item.applied_dressing || '',
      dressingQuantity: item.dressing_quantity || 1,
      dressingFrequency: item.dressing_frequency || '',
      performedProcedures: item.performed_procedures || '',
      clinicalEvolution: item.clinical_evolution || 'Estável',
      photo: item.photo_url,
      aiAreaCm2: item.ai_area_cm2,
      aiLengthCm: item.ai_length_cm,
      aiWidthCm: item.ai_width_cm,
      aiTissueAnalysis: item.ai_tissue_analysis || {},
      aiRecommendation: item.ai_recommendation || '',
      clinicalOutcome: item.clinical_outcome || 'Tratamento em andamento',
      doctorNotes: item.doctor_notes || '',

      entryDate: item.entry_date || null,
      bradenScore: item.braden_score ?? null,
      bradenSubscores: item.braden_subscores || null,
      severity: item.severity || null,
      isRedirect: Boolean(item.is_redirect),
      specialist: item.specialist || '',
      redirectReason: item.redirect_reason || '',
      analysisSource: item.analysis_source || 'manual',

      attachments: item.wound_entry_attachments ? item.wound_entry_attachments.map(att => ({
        id: att.id,
        fileUrl: att.file_url,
        fileName: att.file_name,
        fileType: att.file_type
      })) : []
    }));

    // `photo_url` e `file_url` guardam o caminho no bucket (formato novo) ou uma
    // URL pública legada, que hoje responde 400 porque o bucket não é público.
    // Assinar na leitura conserta os dois casos sem migrar dado.
    const [fotos, anexos] = await Promise.all([
      resolveMediaUrls('wounds', entries.map(e => e.photo)),
      resolveMediaUrls('irec-attachments', entries.flatMap(e => e.attachments.map(a => a.fileUrl)))
    ]);

    return entries.map(e => ({
      ...e,
      photo: e.photo ? (fotos.get(e.photo) || e.photo) : e.photo,
      attachments: e.attachments.map(a => ({
        ...a,
        fileUrl: a.fileUrl ? (anexos.get(a.fileUrl) || a.fileUrl) : a.fileUrl
      }))
    }));
  } catch (err) {
    reportDataFailure('histórico de feridas do paciente', err);
    return getLocalEntries(resolvedId);
  }
};

// 4. Add a new wound entry, including uploading the visual file
export const addWoundEntry = async (arg1, arg2, arg3 = null, arg4 = []) => {
  let entry, photoFile, patientId;

  if (typeof arg1 === 'string' || (arg1 && arg1.length && typeof arg1 === 'string' && arg1.includes('-'))) {
    // Called as addWoundEntry(patientId, entry, photoFile)
    patientId = arg1;
    entry = arg2;
    photoFile = arg3;
  } else {
    // Called as addWoundEntry(entry, photoFile, patientId)
    entry = arg1;
    photoFile = arg2;
    patientId = arg3;
  }

  if (!patientId) {
    patientId = await getActiveUserId();
  }
  if (!patientId) return null;
  let photoUrl = entry.photo; // fallback

  if (!isSupabaseConfigured) {
    let base64Attachments = [];
    if (arg4 && arg4.length > 0) {
      for (const att of arg4) {
        const file = att.file;
        if (file) {
          try {
            const b64 = await fileToBase64(file);
            base64Attachments.push({
              file_name: file.name,
              file_type: file.type.startsWith('image/') ? 'image' : (file.type.startsWith('video/') ? 'video' : 'document'),
              file_url: b64
            });
          } catch (e) {
            console.warn("Falha no b64 local do anexo:", e);
          }
        }
      }
    }

    if (photoFile) {
      try {
        photoUrl = await fileToBase64(photoFile);
      } catch (e) {
        console.warn('Falha no encoding base64 local:', e);
      }
    }
    const newEntry = { ...entry, patientId, id: Date.now(), photo: photoUrl, attachments: base64Attachments };
    const localEntries = getLocalEntries(patientId);
    saveLocalEntries(patientId, [...localEntries, newEntry]);
    return newEntry;
  }

  try {
    if (photoFile) {
      validateFileSize(photoFile);
      // Grava o CAMINHO, não a URL. getPublicUrl() gerava
      // /object/public/wounds/... que responde 400 (bucket não é público), e a
      // URL ficava permanentemente quebrada no prontuário. O caminho é o dado
      // durável; a URL assinada é emitida na leitura.
      //
      // O arquivo vai para a pasta do paciente — sem isso não é possível
      // escrever policy de RLS por auth.uid() sobre o caminho.
      photoUrl = await uploadClinicalMedia('wounds', patientId, photoFile, 'ferida');
    }

    const payload = {
      patient_id: patientId,
      date: entry.date,
      type: entry.type,
      appearance_date: entry.appearanceDate,
      anatomical_location: entry.anatomicalLocation,
      lesion_stage: entry.lesionStage,
      pain: entry.pain,
      exudate: entry.exudate,
      odor: entry.odor,
      local_temperature: entry.localTemperature,
      infection_signs: entry.infectionSigns,
      applied_dressing: entry.appliedDressing,
      dressing_quantity: entry.dressingQuantity,
      dressing_frequency: entry.dressingFrequency,
      performed_procedures: entry.performedProcedures,
      clinical_evolution: entry.clinicalEvolution,
      photo_url: photoUrl,
      ai_area_cm2: entry.aiAreaCm2,
      ai_length_cm: entry.aiLengthCm,
      ai_width_cm: entry.aiWidthCm,
      ai_tissue_analysis: entry.aiTissueAnalysis,
      ai_recommendation: entry.aiRecommendation,
      clinical_outcome: entry.clinicalOutcome,
      doctor_notes: entry.doctorNotes || '',

      // Colunas adicionadas pela migracao 20260821000400. Antes o dado era
      // coletado, exibido e descartado no insert: a escala de Braden e a
      // classificacao de risco da analise nunca chegavam ao prontuario.
      entry_date: entry.entryDate || null,
      braden_score: entry.bradenScore ?? null,
      braden_subscores: entry.bradenSubscores || null,
      severity: entry.severity || null,
      is_redirect: Boolean(entry.isRedirect),
      specialist: entry.specialist || null,
      redirect_reason: entry.redirectReason || null,
      analysis_source: entry.analysisSource || 'manual'
    };

    const { data, error } = await supabase
      .from('wound_entries')
      .insert(payload)
      .select('id')
      .single();

    if (error) throw error;

    // Upload additional attachments if present
    const uploadedAttachments = [];
    if (arg4 && arg4.length > 0) {
      const validAttachments = arg4.filter(att => att.file);
      
      // Upload all files in parallel instead of sequentially (fixes N+1 pattern)
      const uploadResults = await Promise.allSettled(
        validAttachments.map(async (att) => {
          const file = att.file;
          validateFileSize(file);
          const storagePath = await uploadClinicalMedia('irec-attachments', patientId, file, 'anexo');

          let fileType = 'document';
          if (file.type.startsWith('image/')) fileType = 'image';
          else if (file.type.startsWith('video/')) fileType = 'video';
          
          return { storagePath, fileName: file.name, fileType };
        })
      );
      
      const successfulUploads = uploadResults
        .filter(r => r.status === 'fulfilled')
        .map(r => r.value);

      // Antes, um anexo que falhava no upload desaparecia sem rastro: o
      // allSettled engolia a rejeição, o filtro descartava, e o usuário via
      // "triagem salva" sem os exames que anexou.
      const failedUploads = uploadResults.filter(r => r.status === 'rejected');
      if (failedUploads.length > 0) {
        reportDataFailure(
          `anexo${failedUploads.length > 1 ? 's' : ''} da triagem (${failedUploads.length} de ${validAttachments.length} não subiu)`,
          failedUploads[0].reason
        );
      }
      
      if (successfulUploads.length > 0) {
        // Bulk insert all attachment records at once
        await supabase
          .from('wound_entry_attachments')
          .insert(successfulUploads.map(u => ({
            entry_id: data.id,
            file_url: u.storagePath,
            file_name: u.fileName,
            file_type: u.fileType
          })));
        
        successfulUploads.forEach(u => {
          uploadedAttachments.push({
            fileUrl: u.storagePath,
            fileName: u.fileName,
            fileType: u.fileType
          });
        });
      }
    }

    // Log audit log
    createAuditLog('ADD_WOUND_ENTRY', patientId, { entry_id: data.id, entry_type: entry.type });

    return { ...entry, id: data.id, patientId, photo: photoUrl, attachments: uploadedAttachments };
  } catch (err) {
    console.error('Erro ao salvar entrada no Supabase, caindo para local:', err);
    if (photoFile) {
      try {
        photoUrl = await fileToBase64(photoFile);
      } catch (photoErr) {
        console.error('Erro ao converter foto offline:', photoErr);
      }
    }
    const newEntry = { ...entry, patientId, id: Date.now(), photo: photoUrl };
    const localEntries = getLocalEntries(patientId);
    saveLocalEntries(patientId, [...localEntries, newEntry]);
    return newEntry;
  }
};

// 5. Upload exam document and automatically run triage rules
export const uploadExamFileAndTriage = async (examKey, file, fileName, currentProfile) => {
  const examDate = new Date().toLocaleDateString('pt-BR');
  let triageAlert = '';
  let examType = '';

  if (examKey === 'hemograma') {
    examType = 'Hemograma Completo';
    triageAlert = '⚠️ Suspeita de Infecção/Inflamação (Leucócitos: 13.500/mm³)';
  } else if (examKey === 'doppler') {
    examType = 'Doppler Vascular';
    triageAlert = '⚠️ Insuficiência Venosa Crônica (Refluxo de Safenas)';
  } else if (examKey === 'glicose') {
    examType = 'Glicose e HbA1c';
    triageAlert = '⚠️ Descontrole Glicêmico Severo (HbA1c: 8.2%)';
  }

  const newExamEntry = { name: fileName, date: examDate, type: examType };

  const currentExams = currentProfile.attachedExams || [];
  const currentAlerts = currentProfile.triageAlerts || [];

  const examExists = currentExams.some(e => e.name === fileName);
  const alertExists = currentAlerts.includes(triageAlert);

  const updatedExams = examExists ? currentExams : [...currentExams, newExamEntry];
  const updatedAlerts = alertExists ? currentAlerts : [...currentAlerts, triageAlert];

  const updatedProfile = {
    ...currentProfile,
    attachedExams: updatedExams,
    triageAlerts: updatedAlerts,
    ...(examKey === 'glicose' ? { hasDiabetes: true } : {})
  };

  if (!isSupabaseConfigured) {
    saveLocalProfile(currentProfile.id, updatedProfile);
    
    // If the active user profile was updated, sync it
    const active = localStorage.getItem('irec_active_user');
    if (active) {
      const activeObj = JSON.parse(active);
      if (activeObj.id === currentProfile.id) {
        localStorage.setItem('irec_active_user', JSON.stringify(updatedProfile));
      }
    }
    return updatedProfile;
  }

  try {
    // If a physical file was provided, upload to 'exams' bucket
    if (file) {
      const fileExt = file.name.split('.').pop();
      const uniqueFileName = `${Date.now()}_exam.${fileExt}`;
      const filePath = `${uniqueFileName}`;

      const { error: uploadError } = await supabase.storage
        .from('exams')
        .upload(filePath, file);

      if (uploadError) {
        console.warn('Erro no upload do exame para o storage:', uploadError);
      }
    }

    // Save profile update to database
    const payload = {
      attached_exams: updatedExams,
      triage_alerts: updatedAlerts,
      ...(examKey === 'glicose' ? { has_diabetes: true } : {})
    };

    const { error } = await supabase
      .from('clinical_profile')
      .update(payload)
      .eq('id', currentProfile.id);

    if (error) throw error;

    return updatedProfile;
  } catch (err) {
    console.error('Erro ao atualizar triagem do exame no Supabase:', err);
    saveLocalProfile(currentProfile.id, updatedProfile);
    return updatedProfile;
  }
};


// --- CLINICIAN / DOCTOR SERVICES ---

// 1. Get all patient profiles
export const getAllPatients = async () => {
  if (!isSupabaseConfigured) {
    const users = getLocalUsers().filter(u => u.role === 'patient');
    return users.map(u => getLocalProfile(u.id)).filter(Boolean);
  }

  try {
    const { data, error } = await supabase
      .from('clinical_profile')
      .select('*')
      .eq('role', 'patient')
      .order('name', { ascending: true });

    if (error) throw error;

    return data.map(item => ({
      id: item.id,
      role: item.role,
      name: item.name,
      email: item.email,
      birthDate: item.birth_date || '',
      gender: item.gender || '',
      healthUnit: item.health_unit || '',
      hasDiabetes: item.has_diabetes,
      hasHypertension: item.has_hypertension,
      hasVenousInsufficiency: item.has_venous_insufficiency,
      hasPeripheralArterialDisease: item.has_peripheral_arterial_disease,
      isSmoker: item.is_smoker,
      isObese: item.is_obese,
      hasAmputationHistory: item.has_amputation_history,
      otherConditions: item.other_conditions || '',
      medications: item.medications || '',
      allergies: item.allergies || '',
      attachedExams: item.attached_exams || [],
      triageAlerts: item.triage_alerts || [],
      cpf: item.cpf || '',
      rg: item.rg || '',
      cns: item.cns || '',
      phone: item.phone || '',
      emergencyContactName: item.emergency_contact_name || '',
      emergencyContactPhone: item.emergency_contact_phone || '',
      cep: item.cep || '',
      street: item.street || '',
      number: item.number || '',
      complement: item.complement || '',
      neighborhood: item.neighborhood || '',
      city: item.city || '',
      state: item.state || '',
      weight: item.weight || '',
      height: item.height || '',
      bloodType: item.blood_type || '',
      mobility: item.mobility || '',
      nutritionalStatus: item.nutritional_status || '',
      alcoholism: item.alcoholism || false,
      hasCaregiver: item.has_caregiver || false,
      caregiverName: item.caregiver_name || '',
      avatarUrl: item.avatar_url || '',
      lastSeenAt: item.last_seen_at || ''
    }));
  } catch (err) {
    reportDataFailure('lista de pacientes', err);
    const users = getLocalUsers().filter(u => u.role === 'patient');
    return users.map(u => getLocalProfile(u.id)).filter(Boolean);
  }
};

// 1.2. Get all registered nurses
/**
 * Mapeia uma linha da view `clinicians_directory`.
 *
 * As tres leituras de diretorio faziam `select('*')` em clinical_profile, o que
 * trazia CPF, data de nascimento, e-mail e o documento de credenciamento junto —
 * e obrigaria a RLS a liberar todo profissional para todo usuario logado. A view
 * expoe so coluna publica.
 *
 * Tres colunas que EXISTEM no banco e nao eram mapeadas aqui:
 * `consultation_fee`, `bio` e `education`. Por causa disso o preco configurado
 * pelo profissional nunca chegava ao agendamento (BookingModal caia no valor
 * fixo de 250/130) e a apresentacao escrita no perfil nunca aparecia no
 * diretorio.
 */
const mapDirectoryRow = (item) => ({
  id: item.id,
  role: item.role,
  name: item.name,
  crm: item.crm || '',
  specialty: item.specialty || '',
  rqe: item.rqe || '',
  bio: item.bio || '',
  education: item.education || '',
  consultationFee: item.consultation_fee ?? null,
  price: item.consultation_fee ?? null,
  avatarUrl: item.avatar_url || '',
  city: item.city || '',
  state: item.state || '',
  lastSeenAt: item.last_seen_at || '',
  verificationStatus: item.verification_status || 'unverified'
});

export const getAllNurses = async () => {
  const isNurseSpecialty = (spec) => {
    const s = (spec || '').toLowerCase();
    return s.includes('estomaterapia') || s.includes('enfermagem') || s.includes('enfermeir');
  };

  if (!isSupabaseConfigured) {
    const users = getLocalUsers().filter(u => u.role === 'doctor' && isNurseSpecialty(u.specialty));
    return users.map(u => getLocalProfile(u.id)).filter(isVerifiedProfile);
  }

  try {
    // A view ja filtra papel, verificacao e a conta de admin.
    const { data, error } = await supabase
      .from('clinicians_directory')
      .select('*');

    if (error) throw error;

    const filtered = data.filter(item => isNurseSpecialty(item.specialty));

    return filtered.map(mapDirectoryRow);
  } catch (err) {
    reportDataFailure('lista de enfermeiros', err);
    const users = getLocalUsers().filter(u => u.role === 'doctor' && isNurseSpecialty(u.specialty));
    return users.map(u => getLocalProfile(u.id)).filter(isVerifiedProfile);
  }
};

// 1.2.1. Get all registered doctors (excluding nurses)
export const getAllDoctors = async () => {
  const isNurseSpecialty = (spec) => {
    const s = (spec || '').toLowerCase();
    return s.includes('estomaterapia') || s.includes('enfermagem') || s.includes('enfermeir');
  };

  if (!isSupabaseConfigured) {
    const users = getLocalUsers().filter(u => u.role === 'doctor' && !isNurseSpecialty(u.specialty) && u.email !== 'admin@irec.com');
    return users.map(u => getLocalProfile(u.id)).filter(isVerifiedProfile);
  }

  try {
    // A view ja filtra papel, verificacao e a conta de admin.
    const { data, error } = await supabase
      .from('clinicians_directory')
      .select('*');

    if (error) throw error;

    const filtered = data.filter(item => !isNurseSpecialty(item.specialty));

    return filtered.map(mapDirectoryRow);
  } catch (err) {
    reportDataFailure('lista de médicos', err);
    const users = getLocalUsers().filter(u => u.role === 'doctor' && !isNurseSpecialty(u.specialty) && u.email !== 'admin@irec.com');
    return users.map(u => getLocalProfile(u.id)).filter(isVerifiedProfile);
  }
};

// --- APPOINTMENTS & HIRING SERVICES ---
const getLocalAppointments = () => JSON.parse(localStorage.getItem('irec_appointments') || '[]');
const saveLocalAppointments = (apps) => localStorage.setItem('irec_appointments', JSON.stringify(apps));

/**
 * Verifica se o horário do médico já está ocupado.
 *
 * Antes, o `catch` devolvia `false` — "não há conflito". Uma verificação de
 * integridade que falha aberta: com a rede fora, o RLS bloqueando ou a tabela
 * ausente, o agendamento passava por cima de outro já existente.
 *
 * Agora propaga o erro. Quem agenda decide o que fazer, mas não recebe mais uma
 * resposta afirmativa que a função não tinha como dar.
 *
 * @throws quando não foi possível consultar a agenda
 */
const isSlotTaken = (apps, date, time) =>
  apps.some(app => {
    if (app.status === 'canceled' || app.status === 'Cancelado') return false;
    return app.appointmentDate === date && app.appointmentTime === time;
  });

export const checkAppointmentCollision = async (doctorId, date, time) => {
  // Modo de contingência: sem backend, o melhor possível é conferir o que existe
  // neste dispositivo. Lançar aqui bloquearia todo agendamento offline.
  if (!isSupabaseConfigured) {
    const localApps = getLocalAppointments().filter(a => a.doctorId === doctorId);
    return isSlotTaken(localApps, date, time);
  }

  let existingApps;
  try {
    existingApps = await fetchDoctorAppointmentsRemote(doctorId);
  } catch (err) {
    reportDataFailure('agenda do profissional', err);
    throw new Error(
      'Não foi possível verificar a agenda do profissional para confirmar que o horário está livre. ' +
      'Tente novamente em instantes.',
      { cause: err }
    );
  }

  if (!Array.isArray(existingApps)) {
    throw new Error(
      'Não foi possível verificar a agenda do profissional para confirmar que o horário está livre.'
    );
  }

  return existingApps.some(app => {
    if (app.status === 'canceled' || app.status === 'Cancelado') return false;
    return app.appointmentDate === date && app.appointmentTime === time;
  });
};

export const updateAppointmentStatus = async (appointmentId, status) => {
  const localApps = getLocalAppointments();
  const idx = localApps.findIndex(a => a.id === appointmentId);
  if (idx !== -1) {
    localApps[idx].status = status;
    saveLocalAppointments(localApps);
  }

  if (isSupabaseConfigured) {
    try {
      await supabase
        .from('appointments')
        .update({ status: status })
        .eq('id', appointmentId);
    } catch (err) {
      console.warn('[iRec] Erro ao atualizar status da consulta no Supabase:', err);
    }
  }
  return true;
};

export const createAppointment = async (appointmentData) => {
  // Cal.com collision prevention check
  const isColliding = await checkAppointmentCollision(
    appointmentData.doctorId, 
    appointmentData.appointmentDate, 
    appointmentData.appointmentTime
  );

  if (isColliding) {
    throw new Error('Este horário acabou de ser reservado por outro paciente. Por favor, selecione outro horário disponível.');
  }

  const newApp = {
    id: `app_${Date.now()}`,
    createdAt: new Date().toISOString(),
    status: appointmentData.status || 'confirmed',
    ...appointmentData
  };

  // Always save in localStorage for instant offline access
  const localApps = getLocalAppointments();
  localApps.unshift(newApp);
  saveLocalAppointments(localApps);

  if (isSupabaseConfigured) {
    try {
      const payload = {
        id: newApp.id,
        patient_id: appointmentData.patientId,
        doctor_id: appointmentData.doctorId,
        patient_name: appointmentData.patientName,
        doctor_name: appointmentData.doctorName,
        doctor_specialty: appointmentData.doctorSpecialty,
        modality: appointmentData.modality,
        appointment_date: appointmentData.appointmentDate,
        appointment_time: appointmentData.appointmentTime,
        notes: appointmentData.notes,
        address: appointmentData.address,
        price: appointmentData.price,
        payment_method: appointmentData.paymentMethod,
        payment_status: appointmentData.paymentStatus || 'pending',
        status: appointmentData.status || 'confirmed'
      };

      const { error } = await supabase.from('appointments').insert(payload);
      if (error) throw error;
      newApp.syncedToServer = true;
    } catch (err) {
      // A gravação remota falhou. Antes isso era um console.warn e a função
      // devolvia sucesso: o app dizia "consulta agendada", o registro existia
      // só no navegador do paciente, e o médico nunca via nada. É assim que a
      // ausência da tabela `appointments` em producao passou despercebida.
      //
      // O registro local é mantido — serve de rascunho para nova tentativa —,
      // mas quem chamou precisa saber que não está agendado de verdade.
      reportDataFailure('agendamento de consulta', err);
      newApp.syncedToServer = false;
      const erro = new Error(
        'A consulta não pôde ser registrada no servidor. Ela ficou salva apenas neste ' +
        'dispositivo e o profissional NÃO foi notificado. Tente novamente quando a ' +
        'conexão voltar.',
        { cause: err }
      );
      erro.localOnlyAppointment = newApp;
      throw erro;
    }
  }

  return newApp;
};

export const getPatientAppointments = async (patientId) => {
  const localApps = getLocalAppointments().filter(a => a.patientId === patientId);

  if (!isSupabaseConfigured) return localApps;

  try {
    const { data, error } = await supabase
      .from('appointments')
      .select('*')
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false });

    // Mesmo defeito que estava em getDoctorAppointments: a condição
    // `!error && data && data.length > 0` tratava consulta com erro e agenda
    // legitimamente vazia da mesma forma, devolvendo o conteúdo do localStorage
    // nos dois casos.
    if (error) throw error;
    return (data || []).map(mapAppointmentRow);
  } catch (err) {
    reportDataFailure('minhas consultas', err);
    return localApps;
  }
};

export const cancelAppointment = async (appointmentId) => {
  if (!appointmentId) return false;
  
  if (isSupabaseConfigured) {
    try {
      const { error } = await supabase
        .from('appointments')
        .update({ status: 'canceled' })
        .eq('id', appointmentId);
        
      if (error) console.warn('[iRec] Erro ao cancelar agendamento no Supabase:', error.message);
    } catch (err) {
      console.warn('[iRec] Erro ao cancelar no Supabase:', err);
    }
  }
  
  const apps = getLocalAppointments();
  const updated = apps.map(a => a.id === appointmentId ? { ...a, status: 'canceled' } : a);
  saveLocalAppointments(updated);
  return true;
};

const mapAppointmentRow = (item) => ({
  id: item.id,
  createdAt: item.created_at,
  patientId: item.patient_id,
  doctorId: item.doctor_id,
  patientName: item.patient_name,
  doctorName: item.doctor_name,
  doctorSpecialty: item.doctor_specialty,
  modality: item.modality,
  appointmentDate: item.appointment_date,
  appointmentTime: item.appointment_time,
  notes: item.notes,
  address: item.address,
  price: item.price ? parseFloat(item.price) : 0,
  paymentMethod: item.payment_method,
  paymentStatus: item.payment_status,
  status: item.status
});

/**
 * Leitura remota da agenda do médico. **Lança** quando não consegue ler.
 *
 * Existe separada porque a versão tolerante (`getDoctorAppointments`) não
 * consegue distinguir "agenda vazia" de "não consegui ler", e há chamador —
 * a verificação de colisão de horário — para quem essa diferença é a única
 * coisa que importa.
 *
 * @throws quando o Supabase não está configurado ou a consulta falha
 */
const fetchDoctorAppointmentsRemote = async (doctorId) => {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase não configurado: agenda remota indisponível.');
  }

  const { data, error } = await supabase
    .from('appointments')
    .select('*')
    .eq('doctor_id', doctorId)
    .order('created_at', { ascending: false });

  // Erros do PostgREST chegam em `error`, não como exceção. Antes esta condição
  // era `if (!error && data && data.length > 0)`, o que juntava três coisas
  // diferentes — consulta com erro, agenda vazia e agenda cheia — e devolvia o
  // conteúdo do localStorage nos dois primeiros casos. É o motivo de a tabela
  // `appointments` estar ausente em produção sem ninguém notar.
  if (error) {
    throw error;
  }

  return (data || []).map(mapAppointmentRow);
};

export const getDoctorAppointments = async (doctorId) => {
  const localApps = getLocalAppointments().filter(a => a.doctorId === doctorId);

  if (!isSupabaseConfigured) return localApps;

  try {
    return await fetchDoctorAppointmentsRemote(doctorId);
  } catch (err) {
    // Registra para o aviso da interface: o que a tela mostrar a partir daqui é
    // só o que existe neste dispositivo, não a agenda real.
    reportDataFailure('agenda do profissional', err);
    return localApps;
  }
};

// 1.2.2. Get all clinical professionals (doctors + nurses)
export const getAllClinicians = async () => {
  if (!isSupabaseConfigured) {
    const users = getLocalUsers().filter(u => u.role === 'doctor' && u.email !== 'admin@irec.com');
    return users.map(u => getLocalProfile(u.id)).filter(isVerifiedProfile);
  }

  try {
    // A view ja filtra papel, verificacao e a conta de admin.
    const { data, error } = await supabase
      .from('clinicians_directory')
      .select('*');

    if (error) throw error;

    // Sem filtro adicional: a view ja restringe a clinicos verificados.
    return data.map(mapDirectoryRow);
  } catch (err) {
    reportDataFailure('lista de profissionais', err);
    const users = getLocalUsers().filter(u => u.role === 'doctor' && u.email !== 'admin@irec.com');
    return users.map(u => getLocalProfile(u.id)).filter(isVerifiedProfile);
  }
};

// 2. Follow a patient (Add assignment)
export const followPatient = async (doctorId, patientId) => {
  if (!doctorId || !patientId) return false;

  if (!isSupabaseConfigured) {
    const assignments = getLocalAssignments();
    const exists = assignments.some(a => a.doctor_id === doctorId && a.patient_id === patientId);
    if (!exists) {
      assignments.push({ doctor_id: doctorId, patient_id: patientId });
      saveLocalAssignments(assignments);
    }
    return true;
  }

  try {
    const { error } = await supabase
      .from('doctor_patient_assignment')
      .insert({ doctor_id: doctorId, patient_id: patientId });

    if (error) {
      if (error.code === '23505') return true; // unique constraint violation, already following
      throw error;
    }
    return true;
  } catch (err) {
    console.error('Erro ao seguir paciente no Supabase:', err);
    const assignments = getLocalAssignments();
    const exists = assignments.some(a => a.doctor_id === doctorId && a.patient_id === patientId);
    if (!exists) {
      assignments.push({ doctor_id: doctorId, patient_id: patientId });
      saveLocalAssignments(assignments);
    }
    return true;
  }
};

// 3. Unfollow a patient (Remove assignment)
export const unfollowPatient = async (doctorId, patientId) => {
  if (!doctorId || !patientId) return false;

  if (!isSupabaseConfigured) {
    const assignments = getLocalAssignments().filter(
      a => !(a.doctor_id === doctorId && a.patient_id === patientId)
    );
    saveLocalAssignments(assignments);
    return true;
  }

  try {
    const { error } = await supabase
      .from('doctor_patient_assignment')
      .delete()
      .eq('doctor_id', doctorId)
      .eq('patient_id', patientId);

    if (error) throw error;
    return true;
  } catch (err) {
    console.error('Erro ao deixar de seguir paciente no Supabase:', err);
    const assignments = getLocalAssignments().filter(
      a => !(a.doctor_id === doctorId && a.patient_id === patientId)
    );
    saveLocalAssignments(assignments);
    return true;
  }
};

// 4. Get patients followed by a doctor
export const getAssignedPatients = async (doctorId) => {
  if (!doctorId) return [];

  if (!isSupabaseConfigured) {
    const assignments = getLocalAssignments().filter(a => a.doctor_id === doctorId);
    const patientIds = assignments.map(a => a.patient_id);
    return patientIds.map(id => getLocalProfile(id)).filter(Boolean);
  }

  try {
    // Query doctor_patient_assignment joining profiles or simply fetching IDs and querying profiles
    const { data: assignments, error: assError } = await supabase
      .from('doctor_patient_assignment')
      .select('patient_id')
      .eq('doctor_id', doctorId);

    if (assError) throw assError;
    if (assignments.length === 0) return [];

    const patientIds = assignments.map(a => a.patient_id);
    
    const { data: profiles, error: profError } = await supabase
      .from('clinical_profile')
      .select('*')
      .in('id', patientIds);

    if (profError) throw profError;

    return profiles.map(item => ({
      id: item.id,
      role: item.role,
      name: item.name,
      email: item.email,
      birthDate: item.birth_date || '',
      gender: item.gender || '',
      healthUnit: item.health_unit || '',
      hasDiabetes: item.has_diabetes,
      hasHypertension: item.has_hypertension,
      hasVenousInsufficiency: item.has_venous_insufficiency,
      hasPeripheralArterialDisease: item.has_peripheral_arterial_disease,
      isSmoker: item.is_smoker,
      isObese: item.is_obese,
      hasAmputationHistory: item.has_amputation_history,
      otherConditions: item.other_conditions || '',
      medications: item.medications || '',
      allergies: item.allergies || '',
      attachedExams: item.attached_exams || [],
      triageAlerts: item.triage_alerts || [],
      cpf: item.cpf || '',
      rg: item.rg || '',
      cns: item.cns || '',
      phone: item.phone || '',
      emergencyContactName: item.emergency_contact_name || '',
      emergencyContactPhone: item.emergency_contact_phone || '',
      cep: item.cep || '',
      street: item.street || '',
      number: item.number || '',
      complement: item.complement || '',
      neighborhood: item.neighborhood || '',
      city: item.city || '',
      state: item.state || '',
      weight: item.weight || '',
      height: item.height || '',
      bloodType: item.blood_type || '',
      mobility: item.mobility || '',
      nutritionalStatus: item.nutritional_status || '',
      alcoholism: item.alcoholism || false,
      hasCaregiver: item.has_caregiver || false,
      caregiverName: item.caregiver_name || '',
      avatarUrl: item.avatar_url || '',
      lastSeenAt: item.last_seen_at || ''
    }));
  } catch (err) {
    reportDataFailure('pacientes acompanhados', err);
    const assignments = getLocalAssignments().filter(a => a.doctor_id === doctorId);
    const patientIds = assignments.map(a => a.patient_id);
    return patientIds.map(id => getLocalProfile(id)).filter(Boolean);
  }
};

// 5. Get doctor assigned to a patient
export const getAssignedDoctor = async (patientId) => {
  if (!patientId) return null;

  if (!isSupabaseConfigured) {
    const assignments = getLocalAssignments().filter(a => a.patient_id === patientId);
    if (assignments.length === 0) return null;
    const docProfile = getLocalProfile(assignments[0].doctor_id);
    if (!docProfile) return null;
    return {
      id: docProfile.id,
      name: docProfile.name,
      crm: docProfile.crm || '',
      specialty: docProfile.specialty || '',
      city: docProfile.city || '',
      state: docProfile.state || ''
    };
  }

  try {
    const { data: assignments, error: assError } = await supabase
      .from('doctor_patient_assignment')
      .select('doctor_id')
      .eq('patient_id', patientId)
      .limit(1);

    if (assError) throw assError;
    if (assignments.length === 0) return null;

    const doctorId = assignments[0].doctor_id;
    const { data: profile, error: profError } = await supabase
      .from('clinical_profile')
      .select('*')
      .eq('id', doctorId)
      .single();

    if (profError) throw profError;
    return {
      id: profile.id,
      name: profile.name,
      crm: profile.crm || '',
      specialty: profile.specialty || '',
      city: profile.city || '',
      state: profile.state || '',
      avatarUrl: profile.avatar_url || '',
      lastSeenAt: profile.last_seen_at || ''
    };
  } catch (err) {
    reportDataFailure('médico responsável', err);
    const assignments = getLocalAssignments().filter(a => a.patient_id === patientId);
    if (assignments.length === 0) return null;
    const docProfile = getLocalProfile(assignments[0].doctor_id);
    if (!docProfile) return null;
    return {
      id: docProfile.id,
      name: docProfile.name,
      crm: docProfile.crm || '',
      specialty: docProfile.specialty || '',
      city: docProfile.city || '',
      state: docProfile.state || ''
    };
  }
};

// 6. Add a doctor evolution note to a specific wound entry
export const addDoctorNote = async (entryId, notes, appliedDressing = null, dressingFrequency = null) => {
  if (!isSupabaseConfigured) {
    // Offline logic: we must search all patients entries to find this entry ID
    const users = getLocalUsers().filter(u => u.role === 'patient');
    for (const u of users) {
      const entries = getLocalEntries(u.id);
      const entryIdx = entries.findIndex(e => e.id === Number(entryId) || e.id === entryId);
      if (entryIdx !== -1) {
        entries[entryIdx].doctorNotes = notes;
        if (appliedDressing !== null) entries[entryIdx].appliedDressing = appliedDressing;
        if (dressingFrequency !== null) entries[entryIdx].dressingFrequency = dressingFrequency;
        saveLocalEntries(u.id, entries);
        return true;
      }
    }
    return false;
  }

  try {
    const updatePayload = { doctor_notes: notes };
    if (appliedDressing !== null) updatePayload.applied_dressing = appliedDressing;
    if (dressingFrequency !== null) updatePayload.dressing_frequency = dressingFrequency;

    const { error } = await supabase
      .from('wound_entries')
      .update(updatePayload)
      .eq('id', entryId);

    if (error) throw error;
    return true;
  } catch (err) {
    console.error('Erro ao salvar nota do médico no Supabase, caindo para local:', err);
    // Try offline update as fallback
    const users = getLocalUsers().filter(u => u.role === 'patient');
    for (const u of users) {
      const entries = getLocalEntries(u.id);
      const entryIdx = entries.findIndex(e => e.id === Number(entryId) || e.id === entryId);
      if (entryIdx !== -1) {
        entries[entryIdx].doctorNotes = notes;
        if (appliedDressing !== null) entries[entryIdx].appliedDressing = appliedDressing;
        if (dressingFrequency !== null) entries[entryIdx].dressingFrequency = dressingFrequency;
        saveLocalEntries(u.id, entries);
        return true;
      }
    }
    return false;
  }
};

// --- MEDICAL DOCUMENTS SERVICES ---

const getLocalDocuments = () => JSON.parse(localStorage.getItem('irec_medical_documents') || '[]');
const saveLocalDocuments = (docs) => localStorage.setItem('irec_medical_documents', JSON.stringify(docs));

// 1. Issue a new medical document (Prescription or Certificate)
export const issueDocument = async (patientId, doctorId, type, content) => {
  const newDoc = {
    id: `doc_${Date.now()}`,
    patientId,
    doctorId,
    type,
    content,
    createdAt: new Date().toISOString()
  };

  if (!isSupabaseConfigured) {
    const docs = getLocalDocuments();
    docs.push(newDoc);
    saveLocalDocuments(docs);
    return newDoc;
  }

  try {
    const payload = {
      patient_id: patientId,
      doctor_id: doctorId,
      type,
      content,
      created_at: newDoc.createdAt
    };

    const { data, error } = await supabase
      .from('medical_documents')
      .insert(payload)
      .select('id')
      .single();

    if (error) throw error;
    return { ...newDoc, id: data.id };
  } catch (err) {
    console.error('Erro ao emitir documento no Supabase, caindo para local:', err);
    const docs = getLocalDocuments();
    docs.push(newDoc);
    saveLocalDocuments(docs);
    return newDoc;
  }
};

// 2. Fetch documents for a patient
export const getPatientDocuments = async (patientId) => {
  if (!patientId) return [];

  if (!isSupabaseConfigured) {
    const docs = getLocalDocuments();
    return docs.filter(d => d.patientId === patientId).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  try {
    const { data, error } = await supabase
      .from('medical_documents')
      .select('*')
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return data.map(item => ({
      id: item.id,
      patientId: item.patient_id,
      doctorId: item.doctor_id,
      type: item.type,
      content: item.content,
      createdAt: item.created_at
    }));
  } catch (err) {
    reportDataFailure('documentos do paciente', err);
    const docs = getLocalDocuments();
    return docs.filter(d => d.patientId === patientId).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }
};

// 3. Fetch documents issued by a doctor
export const getDoctorDocuments = async (doctorId) => {
  if (!doctorId) return [];

  if (!isSupabaseConfigured) {
    const docs = getLocalDocuments();
    return docs.filter(d => d.doctorId === doctorId).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  try {
    const { data, error } = await supabase
      .from('medical_documents')
      .select('*')
      .eq('doctor_id', doctorId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return data.map(item => ({
      id: item.id,
      patientId: item.patient_id,
      doctorId: item.doctor_id,
      type: item.type,
      content: item.content,
      createdAt: item.created_at
    }));
  } catch (err) {
    reportDataFailure('documentos emitidos pelo médico', err);
    const docs = getLocalDocuments();
    return docs.filter(d => d.doctorId === doctorId).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }
};

// 4. Get local emergency health resources (Hospitals and Pharmacies) based on patient's city
export const getLocalHealthcareResources = () => {
  return {
    hospitals: [],
    pharmacies: []
  };
};


// --- TELEMEDICINE CHAT & CALL SERVICES ---

// BroadcastChannel for real-time signaling / chat local fallback
const chatChannel = typeof window !== 'undefined' ? new BroadcastChannel('irec_telemedicine_signaling') : null;

const getLocalMessages = () => JSON.parse(localStorage.getItem('irec_chat_messages') || '[]');
const saveLocalMessages = (messages) => localStorage.setItem('irec_chat_messages', JSON.stringify(messages));

const getLocalCalls = () => JSON.parse(localStorage.getItem('irec_local_calls') || '[]');
const saveLocalCalls = (calls) => localStorage.setItem('irec_local_calls', JSON.stringify(calls));

// 1. Fetch Chat Messages (between two users)
export const getChatMessages = async (userId, contactId) => {
  if (!userId || !contactId) return [];

  if (!isSupabaseConfigured) {
    const msgs = getLocalMessages();
    return msgs.filter(m => 
      (m.senderId === userId && m.recipientId === contactId) ||
      (m.senderId === contactId && m.recipientId === userId)
    ).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  }

  try {
    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .or(`and(sender_id.eq.${userId},recipient_id.eq.${contactId}),and(sender_id.eq.${contactId},recipient_id.eq.${userId})`)
      .order('created_at', { ascending: true })
      .limit(200);

    if (error) {
      if (error.code === '42P01') throw error;
      throw error;
    }

    return data.map(item => ({
      id: item.id,
      senderId: item.sender_id,
      recipientId: item.recipient_id,
      message: item.message,
      fileUrl: item.file_url,
      fileName: item.file_name,
      fileType: item.file_type,
      createdAt: item.created_at
    }));
  } catch (err) {
    console.warn('Erro ao buscar chat do Supabase, usando local:', err);
    const msgs = getLocalMessages();
    return msgs.filter(m => 
      (m.senderId === userId && m.recipientId === contactId) ||
      (m.senderId === contactId && m.recipientId === userId)
    ).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  }
};

// 1.3. Fetch all messages received by a specific user
export const getAllReceivedMessages = async (userId) => {
  if (!userId) return [];

  if (!isSupabaseConfigured) {
    const msgs = getLocalMessages();
    return msgs.filter(m => m.recipientId === userId)
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  }

  try {
    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('recipient_id', userId)
      .order('created_at', { ascending: true })
      .limit(200);

    if (error) throw error;

    return data.map(item => ({
      id: item.id,
      senderId: item.sender_id,
      recipientId: item.recipient_id,
      message: item.message,
      fileUrl: item.file_url,
      fileName: item.file_name,
      fileType: item.file_type,
      createdAt: item.created_at
    }));
  } catch (err) {
    reportDataFailure('mensagens do chat', err);
    const msgs = getLocalMessages();
    return msgs.filter(m => m.recipientId === userId)
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  }
};

// 2. Send Chat Message (text and optional attachment file)
export const sendChatMessage = async (senderId, recipientId, text, fileObj = null, fileType = null) => {
  if (!senderId || !recipientId) return null;

  let fileUrl = null;
  let fileName = fileObj ? fileObj.name : null;

  const newMsg = {
    id: `msg_${Date.now()}`,
    senderId,
    recipientId,
    message: text || '',
    fileUrl: null,
    fileName,
    fileType,
    createdAt: new Date().toISOString()
  };

  if (!isSupabaseConfigured) {
    if (fileObj) {
      try {
        const base64 = await fileToBase64(fileObj);
        newMsg.fileUrl = base64;
      } catch (e) {
        console.warn('Falha base64 local no chat:', e);
      }
    }
    const msgs = getLocalMessages();
    msgs.push(newMsg);
    saveLocalMessages(msgs);
    
    if (chatChannel) {
      chatChannel.postMessage({ type: 'NEW_MESSAGE', message: newMsg });
    }
    return newMsg;
  }

  try {
    if (fileObj) {
      const fileExt = fileObj.name.split('.').pop();
      const uniqueFileName = `${Date.now()}_chat.${fileExt}`;
      const filePath = `${uniqueFileName}`;

      const { error: uploadError } = await supabase.storage
        .from('chat_attachments')
        .upload(filePath, fileObj);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('chat_attachments')
        .getPublicUrl(filePath);

      fileUrl = publicUrl;
      newMsg.fileUrl = fileUrl;
    }

    const payload = {
      sender_id: senderId,
      recipient_id: recipientId,
      message: text || '',
      file_url: fileUrl,
      file_name: fileName,
      file_type: fileType,
      created_at: newMsg.createdAt
    };

    const { data, error } = await supabase
      .from('chat_messages')
      .insert(payload)
      .select('id')
      .single();

    if (error) throw error;
    newMsg.id = data.id;

    if (chatChannel) {
      chatChannel.postMessage({ type: 'NEW_MESSAGE', message: newMsg });
    }
    return newMsg;
  } catch (err) {
    console.warn('Erro ao enviar mensagem no Supabase, caindo para local:', err);
    if (fileObj) {
      try {
        const base64 = await fileToBase64(fileObj);
        newMsg.fileUrl = base64;
      } catch (fileErr) {
        console.error('Erro ao converter arquivo offline no chat:', fileErr);
      }
    }
    const msgs = getLocalMessages();
    msgs.push(newMsg);
    saveLocalMessages(msgs);
    if (chatChannel) {
      chatChannel.postMessage({ type: 'NEW_MESSAGE', message: newMsg });
    }
    return newMsg;
  }
};

// 3. Telemedicine Video Call Control
export const placeTelemedicineCall = async (callerId, receiverId) => {
  if (!callerId || !receiverId) return null;

  const newCall = {
    id: `call_${Date.now()}`,
    callerId,
    receiverId,
    status: 'ringing',
    createdAt: new Date().toISOString()
  };

  if (chatChannel) {
    chatChannel.postMessage({ type: 'INCOMING_CALL', call: newCall });
  }

  if (!isSupabaseConfigured) {
    const calls = getLocalCalls();
    calls.push(newCall);
    saveLocalCalls(calls);
    return newCall;
  }

  try {
    const payload = {
      caller_id: callerId,
      receiver_id: receiverId,
      status: 'ringing',
      created_at: newCall.createdAt
    };

    const { data, error } = await supabase
      .from('telemedicine_calls')
      .insert(payload)
      .select('id')
      .single();

    if (error) throw error;
    return { ...newCall, id: data.id };
  } catch (err) {
    console.warn('Erro ao registrar chamada no Supabase, usando local:', err);
    const calls = getLocalCalls();
    calls.push(newCall);
    saveLocalCalls(calls);
    return newCall;
  }
};

export const updateCallStatus = async (callId, status, duration = 0) => {
  if (!callId) return false;

  if (chatChannel) {
    chatChannel.postMessage({ type: 'CALL_STATUS_UPDATE', callId, status, duration });
  }

  const isNumericId = /^\d+$/.test(callId.toString());

  if (!isSupabaseConfigured || !isNumericId) {
    const calls = getLocalCalls();
    const idx = calls.findIndex(c => c.id.toString() === callId.toString());
    if (idx !== -1) {
      calls[idx].status = status;
      calls[idx].duration = duration;
      saveLocalCalls(calls);
      return true;
    }
    return false;
  }

  try {
    const { error } = await supabase
      .from('telemedicine_calls')
      .update({ status, duration_seconds: duration, updated_at: new Date().toISOString() })
      .eq('id', callId);

    if (error) throw error;
    return true;
  } catch (err) {
    console.warn('Erro ao atualizar chamada no Supabase, caindo para local:', err);
    const calls = getLocalCalls();
    const idx = calls.findIndex(c => c.id.toString() === callId.toString());
    if (idx !== -1) {
      calls[idx].status = status;
      calls[idx].duration = duration;
      saveLocalCalls(calls);
      return true;
    }
    return false;
  }
};

export const checkIncomingCalls = async (userId) => {
  if (!userId) return null;

  if (!isSupabaseConfigured) {
    const calls = getLocalCalls();
    const ringing = calls.find(c => c.receiverId === userId && c.status === 'ringing');
    return ringing ? {
      id: ringing.id,
      callerId: ringing.callerId,
      receiverId: ringing.receiverId,
      status: ringing.status
    } : null;
  }

  try {
    const { data, error } = await supabase
      .from('telemedicine_calls')
      .select('*')
      .eq('receiver_id', userId)
      .eq('status', 'ringing')
      .order('id', { ascending: false })
      .limit(1);

    if (error) throw error;
    if (data && data.length > 0) {
      const first = data[0];
      return {
        id: first.id,
        callerId: first.caller_id,
        receiverId: first.receiver_id,
        status: first.status
      };
    }
    return null;
  } catch {
    const calls = getLocalCalls();
    const ringing = calls.find(c => c.receiverId === userId && c.status === 'ringing');
    return ringing ? {
      id: ringing.id,
      callerId: ringing.callerId,
      receiverId: ringing.receiverId,
      status: ringing.status
    } : null;
  }
};

export const checkCallStatus = async (callId) => {
  if (!callId) return null;

  const isNumericId = /^\d+$/.test(callId.toString());

  if (!isSupabaseConfigured || !isNumericId) {
    const calls = getLocalCalls();
    const call = calls.find(c => c.id.toString() === callId.toString());
    return call ? {
      id: call.id,
      callerId: call.callerId,
      receiverId: call.receiverId,
      status: call.status
    } : null;
  }

  try {
    const { data, error } = await supabase
      .from('telemedicine_calls')
      .select('*')
      .eq('id', callId)
      .single();

    if (error) throw error;
    return {
      id: data.id,
      callerId: data.caller_id,
      receiverId: data.receiver_id,
      status: data.status
    };
  } catch {
    const calls = getLocalCalls();
    const call = calls.find(c => c.id.toString() === callId.toString());
    return call ? {
      id: call.id,
      callerId: call.callerId,
      receiverId: call.receiverId,
      status: call.status
    } : null;
  }
};

export const subscribeToSignalingEvents = (onMessageReceived, onIncomingCall, onCallStatusUpdate, onTranscriptChunkReceived) => {
  if (!chatChannel) return () => {};

  const listener = (event) => {
    const data = event.data;
    if (data.type === 'NEW_MESSAGE' && onMessageReceived) {
      onMessageReceived(data.message);
    } else if (data.type === 'INCOMING_CALL' && onIncomingCall) {
      onIncomingCall(data.call);
    } else if (data.type === 'CALL_STATUS_UPDATE' && onCallStatusUpdate) {
      onCallStatusUpdate(data.callId, data.status, data.duration);
    } else if (data.type === 'TRANSCRIPT_CHUNK' && onTranscriptChunkReceived) {
      onTranscriptChunkReceived(data.senderRole, data.text);
    }
  };

  chatChannel.addEventListener('message', listener);
  return () => {
    chatChannel.removeEventListener('message', listener);
  };
};

export const sendTranscriptChunk = (senderRole, text) => {
  if (chatChannel) {
    chatChannel.postMessage({
      type: 'TRANSCRIPT_CHUNK',
      senderRole,
      text
    });
  }
};

// Update last seen timestamp for user presence
export const updateLastSeen = async (userId) => {
  if (!isSupabaseConfigured || !userId) return null;
  try {
    const { data, error } = await supabase
      .from('clinical_profile')
      .update({ last_seen_at: new Date().toISOString() })
      .eq('id', userId)
      .select('id, last_seen_at')
      .single();
    if (error) throw error;
    return data;
  } catch {
    return null;
  }
};

// Get all doctors assigned to a patient
export const getAssignedDoctors = async (patientId) => {
  if (!patientId) return [];

  if (!isSupabaseConfigured) {
    const assignments = getLocalAssignments().filter(a => a.patient_id === patientId);
    const docIds = assignments.map(a => a.doctor_id);
    return docIds.map(id => {
      const docProfile = getLocalProfile(id);
      if (!docProfile || docProfile.email === 'admin@irec.com') return null;
      return {
        id: docProfile.id,
        name: docProfile.name,
        role: 'doctor',
        crm: docProfile.crm || '',
        specialty: docProfile.specialty || '',
        city: docProfile.city || '',
        state: docProfile.state || ''
      };
    }).filter(Boolean);
  }

  try {
    const { data: assignments, error: assError } = await supabase
      .from('doctor_patient_assignment')
      .select('doctor_id')
      .eq('patient_id', patientId);

    if (assError) throw assError;
    if (assignments.length === 0) return [];

    const doctorIds = assignments.map(a => a.doctor_id);
    const { data: profiles, error: profError } = await supabase
      .from('clinical_profile')
      .select('*')
      .in('id', doctorIds);

    if (profError) throw profError;
    
    const filteredProfiles = profiles.filter(profile => profile.email !== 'admin@irec.com');
    
    return filteredProfiles.map(profile => ({
      id: profile.id,
      name: profile.name,
      role: 'doctor',
      crm: profile.crm || '',
      specialty: profile.specialty || '',
      city: profile.city || '',
      state: profile.state || ''
    }));
  } catch (err) {
    reportDataFailure('médicos vinculados', err);
    return [];
  }
};

// ==========================================
// 27. Recommended Materials & Affiliate Links
// ==========================================

export const getRecommendedMaterials = async (patientId = null, doctorId = null) => {
  if (!isSupabaseConfigured) {
    const data = localStorage.getItem('irec_local_recommended_materials') || '[]';
    const list = JSON.parse(data);
    
    if (doctorId && !patientId) {
      // Fetch doctor's own global partner items
      return list.filter(item => item.doctor_id === doctorId && !item.patient_id);
    }
    
    return list.filter(item => {
      if (patientId && doctorId && item.type === 'doctor_partner') {
        return item.patient_id === patientId && item.doctor_id === doctorId;
      }
      return !item.patient_id || (patientId && item.patient_id === patientId);
    });
  }

  try {
    if (doctorId && !patientId) {
      // Fetch doctor's own global partner items
      const { data, error } = await supabase
        .from('recommended_materials')
        .select('*')
        .eq('doctor_id', doctorId)
        .is('patient_id', null);
      if (error) throw error;
      return data;
    }
    
    if (patientId) {
      // Fetch both global platform partners (patient_id is null) AND patient-specific doctor partners
      let query = supabase
        .from('recommended_materials')
        .select('*');
        
      if (doctorId) {
        query = query.or(`and(patient_id.eq.${patientId},doctor_id.eq.${doctorId}),patient_id.is.null`);
      } else {
        query = query.or(`patient_id.is.null,patient_id.eq.${patientId}`);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    } else {
      // Just fetch global platform partners
      const { data, error } = await supabase
        .from('recommended_materials')
        .select('*')
        .is('patient_id', null)
        .is('doctor_id', null);
      if (error) throw error;
      return data;
    }
  } catch (err) {
    reportDataFailure('materiais recomendados', err);
    return [];
  }
};

export const addRecommendedMaterial = async (material) => {
  // Normalize price to numeric or null to prevent database type mismatch (IREC-0103)
  let numericPrice = null;
  if (material.price !== null && material.price !== undefined && material.price !== '') {
    if (typeof material.price === 'number') {
      numericPrice = material.price;
    } else if (typeof material.price === 'string') {
      const cleanStr = material.price.replace(/[^\d.,]/g, '').replace(',', '.');
      const parsed = parseFloat(cleanStr);
      if (!isNaN(parsed)) {
        numericPrice = parsed;
      }
    }
  }

  const sanitizedMaterial = {
    ...material,
    price: numericPrice
  };

  if (!isSupabaseConfigured) {
    const data = localStorage.getItem('irec_local_recommended_materials') || '[]';
    const list = JSON.parse(data);
    const newMaterial = {
      id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 9),
      created_at: new Date().toISOString(),
      ...sanitizedMaterial
    };
    list.push(newMaterial);
    localStorage.setItem('irec_local_recommended_materials', JSON.stringify(list));
    return newMaterial;
  }

  try {
    const { data, error } = await supabase
      .from('recommended_materials')
      .insert([sanitizedMaterial])
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (err) {
    console.error('Error adding recommended material:', err);
    throw err;
  }
};

export const deleteRecommendedMaterial = async (id) => {
  if (!isSupabaseConfigured) {
    const data = localStorage.getItem('irec_local_recommended_materials') || '[]';
    const list = JSON.parse(data);
    const filtered = list.filter(item => item.id !== id);
    localStorage.setItem('irec_local_recommended_materials', JSON.stringify(filtered));
    return true;
  }

  try {
    const { error } = await supabase
      .from('recommended_materials')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return true;
  } catch (err) {
    console.error('Error deleting recommended material:', err);
    throw err;
  }
};

export const getAuditLogs = async () => {
  if (!isSupabaseConfigured) {
    return [];
  }
  try {
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) throw error;
    return data;
  } catch (err) {
    reportDataFailure('trilha de auditoria', err);
    return [];
  }
};

export const getAllProfiles = async () => {
  if (!isSupabaseConfigured) {
    const users = getLocalUsers();
    return users.map(u => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      crm: u.crm || '',
      specialty: u.specialty || '',
      verificationStatus: u.verificationStatus || 'verified',
      professionalDocumentUrl: u.professionalDocumentUrl || ''
    }));
  }
  try {
    const { data, error } = await supabase
      .from('clinical_profile')
      .select('*');
    if (error) throw error;
    return data.map(item => ({
      id: item.id,
      role: item.role,
      name: item.name,
      email: item.email,
      crm: item.crm || '',
      specialty: item.specialty || '',
      rqe: item.rqe || '',
      birthDate: item.birth_date || '',
      gender: item.gender || '',
      healthUnit: item.health_unit || '',
      phone: item.phone || '',
      avatarUrl: item.avatar_url || '',
      city: item.city || '',
      state: item.state || '',
      lastSeenAt: item.last_seen_at || '',
      verificationStatus: item.verification_status || 'unverified',
      professionalDocumentUrl: item.professional_document_url || ''
    }));
  } catch (err) {
    reportDataFailure('perfis cadastrados', err);
    return [];
  }
};

export const getAdminStats = async () => {
  if (!isSupabaseConfigured) {
    const users = getLocalUsers();
    const mats = JSON.parse(localStorage.getItem('irec_local_recommended_materials') || '[]');
    const triages = JSON.parse(localStorage.getItem('irec_local_wound_entries') || '[]');
    
    return {
      patients: users.filter(u => u.role === 'patient').length,
      doctors: users.filter(u => u.role === 'doctor').length,
      nurses: users.filter(u => u.role === 'nurse').length,
      triages: triages.length,
      partners: mats.filter(m => !m.patient_id && !m.doctor_id).length,
      calls: 0
    };
  }

  try {
    const [patientsRes, doctorsRes, nursesRes, triagesRes, partnersRes, callsRes] = await Promise.all([
      supabase.from('clinical_profile').select('id', { count: 'exact', head: true }).eq('role', 'patient'),
      supabase.from('clinical_profile').select('id', { count: 'exact', head: true }).eq('role', 'doctor'),
      supabase.from('clinical_profile').select('id', { count: 'exact', head: true }).eq('role', 'nurse'),
      supabase.from('wound_entries').select('id', { count: 'exact', head: true }),
      supabase.from('recommended_materials').select('id', { count: 'exact', head: true }).is('patient_id', null).is('doctor_id', null),
      supabase.from('telemedicine_calls').select('id', { count: 'exact', head: true })
    ]);

    return {
      patients: patientsRes.count || 0,
      doctors: doctorsRes.count || 0,
      nurses: nursesRes.count || 0,
      triages: triagesRes.count || 0,
      partners: partnersRes.count || 0,
      calls: callsRes.count || 0
    };
  } catch (err) {
    console.error('Error getting admin stats:', err);
    return { patients: 0, doctors: 0, nurses: 0, triages: 0, partners: 0, calls: 0 };
  }
};

export const getAdminTelemedicineCalls = async () => {
  if (!isSupabaseConfigured) {
    return JSON.parse(localStorage.getItem('irec_local_calls') || '[]');
  }
  try {
    const { data, error } = await supabase
      .from('telemedicine_calls')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) throw error;
    return data;
  } catch (err) {
    reportDataFailure('histórico de teleconsultas', err);
    return [];
  }
};

export const getAdminAssignments = async () => {
  if (!isSupabaseConfigured) {
    return JSON.parse(localStorage.getItem('irec_local_assignments') || '[]');
  }
  try {
    const { data, error } = await supabase
      .from('doctor_patient_assignment')
      .select('*')
      .limit(500);
    if (error) throw error;
    return data;
  } catch (err) {
    console.error('Error fetching assignments:', err);
    return [];
  }
};

export const getAdminWoundEntries = async () => {
  if (!isSupabaseConfigured) {
    return JSON.parse(localStorage.getItem('irec_local_wound_entries') || '[]');
  }
  try {
    const { data, error } = await supabase
      .from('wound_entries')
      .select('type, created_at')
      .limit(500);
    if (error) throw error;
    return data;
  } catch (err) {
    console.error('Error fetching admin wound entries:', err);
    return [];
  }
};

export const getDoctorPatientsWoundEntries = async (doctorId) => {
  if (!resolvedIdIsValid(doctorId)) return [];
  if (!isSupabaseConfigured) {
    const assignments = JSON.parse(localStorage.getItem('irec_local_assignments') || '[]');
    const docPatientIds = assignments.filter(a => a.doctor_id === doctorId).map(a => a.patient_id);
    const allWounds = JSON.parse(localStorage.getItem('irec_local_wound_entries') || '[]');
    return allWounds.filter(w => docPatientIds.includes(w.patient_id || w.patientId));
  }
  try {
    const { data: assignments, error: assError } = await supabase
      .from('doctor_patient_assignment')
      .select('patient_id')
      .eq('doctor_id', doctorId);
    
    if (assError) throw assError;
    const patientIds = assignments.map(a => a.patient_id);
    if (patientIds.length === 0) return [];

    const { data, error } = await supabase
      .from('wound_entries')
      .select('*')
      .in('patient_id', patientIds)
      .order('created_at', { ascending: true });
    
    if (error) throw error;
    return data;
  } catch (err) {
    console.error('Error fetching doctor patients wound entries:', err);
    return [];
  }
};

const resolvedIdIsValid = (id) => {
  return id && id.toString().trim().length > 0;
};

export const getDoctorTelemedicineCalls = async (doctorId) => {
  if (!resolvedIdIsValid(doctorId)) return [];
  if (!isSupabaseConfigured) {
    const allCalls = JSON.parse(localStorage.getItem('irec_local_calls') || '[]');
    return allCalls.filter(c => c.caller_id === doctorId || c.receiver_id === doctorId);
  }
  try {
    const { data, error } = await supabase
      .from('telemedicine_calls')
      .select('*')
      .or(`caller_id.eq.${doctorId},receiver_id.eq.${doctorId}`)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data;
  } catch (err) {
    console.error('Error fetching doctor telemedicine calls:', err);
    return [];
  }
};

export const sendWebRTCSignalingEvent = async (callId, senderId, type, payload) => {
  if (!isSupabaseConfigured) return null;
  try {
    const { error } = await supabase
      .from('telemedicine_signaling')
      .insert({
        call_id: callId,
        sender_id: senderId,
        type,
        payload
      });
    if (error) throw error;
    return true;
  } catch (e) {
    console.error("Erro ao enviar sinalizacao WebRTC:", e);
    return false;
  }
};

export const subscribeToWebRTCSignaling = (callId, onSignal) => {
  if (!isSupabaseConfigured || !supabase) return () => {};
  const channel = supabase
    .channel(`webrtc-signaling-${callId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'telemedicine_signaling',
        filter: `call_id=eq.${callId}`
      },
      (payload) => {
        onSignal(payload.new);
      }
    )
    .subscribe();
  return () => {
    channel.unsubscribe();
  };
};

export const uploadProfessionalCredential = async (file) => {
  if (!file) return null;
  if (!isSupabaseConfigured) {
    return 'local_mock_document_url';
  }
  try {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}_credential.${fileExt}`;
    const filePath = `${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('professional-credentials')
      .upload(filePath, file);

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage
      .from('professional-credentials')
      .getPublicUrl(filePath);

    return publicUrl;
  } catch (err) {
    console.error('Erro ao fazer upload de credencial no Supabase:', err);
    throw err;
  }
};

export const verifyProfessionalRegistry = async (crmNumber, uf, type) => {
  // A verificação direta via API externa deve ser processada no servidor/Edge Function para não expor a chave de API no bundle do cliente.
  return { 
    success: true, 
    status: 'pending', 
    message: 'Cadastro submetido para validação cadastral junto ao conselho profissional (' + (type === 'doctor' ? 'CFM' : 'COFEN') + ').' 
  };
};

export const updateVerificationStatus = async (userId, status) => {
  if (!isSupabaseConfigured) {
    const profile = getLocalProfile(userId);
    if (profile) {
      profile.verificationStatus = status;
      saveLocalProfile(userId, profile);
      const users = getLocalUsers();
      const uIndex = users.findIndex(u => u.id === userId);
      if (uIndex !== -1) {
        users[uIndex].verificationStatus = status;
        saveLocalUsers(users);
      }
    }
    return true;
  }
  try {
    const { error } = await supabase
      .from('clinical_profile')
      .update({ verification_status: status })
      .eq('id', userId);

    if (error) throw error;
    return true;
  } catch (err) {
    console.error("Erro ao atualizar status de verificacao:", err);
    throw err;
  }
};

// --- CLINICAL KNOWLEDGE BASE (RAG) MANAGEMENT ---
export const getTrainingKnowledgeList = async () => {
  if (!isSupabaseConfigured) {
    return JSON.parse(localStorage.getItem('irec_training_knowledge') || '[]');
  }
  try {
    const { data, error } = await supabase
      .from('training_knowledge')
      .select('id, video_title, category, content, created_at')
      .order('category', { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error("Erro ao buscar base de conhecimento:", err);
    return [];
  }
};

export const updateTrainingKnowledgeChapter = async (id, category, content) => {
  if (!isSupabaseConfigured) {
    const list = JSON.parse(localStorage.getItem('irec_training_knowledge') || '[]');
    const index = list.findIndex(item => item.id === id);
    if (index !== -1) {
      list[index].category = category;
      list[index].content = content;
      localStorage.setItem('irec_training_knowledge', JSON.stringify(list));
      return true;
    }
    return false;
  }
  try {
    const { error } = await supabase
      .from('training_knowledge')
      .update({ category, content })
      .eq('id', id);

    if (error) throw error;
    return true;
  } catch (err) {
    console.error("Erro ao atualizar base de conhecimento:", err);
    throw err;
  }
};

export const deleteTrainingKnowledgeChapter = async (id) => {
  if (!isSupabaseConfigured) {
    const list = JSON.parse(localStorage.getItem('irec_training_knowledge') || '[]');
    const filtered = list.filter(item => item.id !== id);
    localStorage.setItem('irec_training_knowledge', JSON.stringify(filtered));
    return true;
  }
  try {
    const { error } = await supabase
      .from('training_knowledge')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return true;
  } catch (err) {
    console.error("Erro ao excluir base de conhecimento:", err);
    throw err;
  }
};

