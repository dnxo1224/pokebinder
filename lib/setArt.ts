// 세트 카드에 들어갈 커스텀 아트.
//
// 키는 sets.external_id (예: 'base1', 'base2', 'miscp'),
// 값은 이미지 URL 또는 /public 기준 경로 (예: '/set-art/base1.png').
//
// 여기에 값이 있으면 그 이미지를 쓰고, 없으면 TCGdex 세트 로고로 폴백하며,
// 둘 다 없으면 빈 슬롯 placeholder가 표시된다.
// 나중에 이미지를 받으면 이 맵에 한 줄씩 추가하기만 하면 된다.
export const SET_ART: Record<string, string> = {
  // 'base1': '/set-art/base1.png',
};

/** 세트 하나가 쓸 아트 URL을 고른다. 없으면 null (placeholder 표시). */
export function setArtFor(externalId: string, logoUrl: string | null): string | null {
  const custom = SET_ART[externalId];
  if (custom) return custom;
  // TCGdex 로고는 확장자 없이 오므로 붙여준다.
  if (logoUrl) return `${logoUrl}.png`;
  return null;
}
