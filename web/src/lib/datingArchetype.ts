export {buildDatingArchetypeV2,datingPortraitPromptV2,celebrityVibes} from './datingArchetypeV2'
// Backwards-compatible product default only; explicit render preferences always win.
export function defaultDatingPartnerGender(profileGender:unknown):'male'|'female'|'neutral' {
 return profileGender==='female'?'male':profileGender==='male'?'female':'neutral'
}
