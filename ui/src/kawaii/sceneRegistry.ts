import type { KawaiiCharacterId } from "./characterLibrary";

export type KawaiiSceneId =
  | "office"
  | "staff_room"
  | "approval_budget_room"
  | "issue_quest_room"
  | "goal_strategy_room"
  | "inbox_message_room"
  | "settings_atelier"
  | "project_studio"
  | "runtime_room"
  | "company_hall"
  | "tool_atelier";

export type KawaiiSceneDefinition = {
  id: KawaiiSceneId;
  match: string[];
  speaker: {
    characterId: KawaiiCharacterId;
    title: string;
    name: string;
  };
  text: (context: { companyName: string; ceoHonorific: string }) => string;
  choices: string[];
};

export const kawaiiScenes: KawaiiSceneDefinition[] = [
  {
    id: "staff_room",
    match: ["/agents"],
    speaker: { characterId: "rika", title: "CTO", name: "Rika" },
    text: ({ ceoHonorific }) => `${ceoHonorific}, Staff Room에서 각 에이전트의 상태와 업무 분위기를 한눈에 볼 수 있게 준비했어요.`,
    choices: ["권한 설정", "새 목표 지정", "업무 기록 보기", "팀 구조 변경"],
  },
  {
    id: "approval_budget_room",
    match: ["/approvals", "/costs"],
    speaker: { characterId: "nari", title: "Finance", name: "Nari" },
    text: ({ ceoHonorific }) => `${ceoHonorific}, 승인 요청과 예산 흐름을 함께 확인할 수 있도록 정리했어요. 위험한 선택은 제가 먼저 표시해둘게요.`,
    choices: ["승인 대기 보기", "승인 기록 보기", "예산 확인", "Inbox 확인"],
  },
  {
    id: "issue_quest_room",
    match: ["/issues"],
    speaker: { characterId: "yuna", title: "QA", name: "Yuna" },
    text: () => "오늘의 퀘스트를 정리했어요. 우선순위가 높은 일부터 확인하면 팀이 더 빠르게 움직일 수 있어요.",
    choices: ["진행 중 보기", "막힌 일 찾기", "새 Quest 만들기", "Staff 보기"],
  },
  {
    id: "goal_strategy_room",
    match: ["/goals"],
    speaker: { characterId: "sera", title: "PM", name: "Sera" },
    text: ({ ceoHonorific }) => `${ceoHonorific}, 목표와 전략 흐름을 부드럽게 정리해둘게요.`,
    choices: ["목표 보기", "우선순위 조정", "Staff 배치", "진행률 확인"],
  },
  {
    id: "inbox_message_room",
    match: ["/inbox", "/activity"],
    speaker: { characterId: "yuna", title: "QA", name: "Yuna" },
    text: () => "새 메시지와 업무 기록을 확인했어요. 놓치면 위험한 항목부터 표시해둘게요.",
    choices: ["새 알림", "읽지 않음", "오늘 기록", "Staff 호출"],
  },
  {
    id: "project_studio",
    match: ["/projects", "/workspaces"],
    speaker: { characterId: "sera", title: "PM", name: "Sera" },
    text: ({ ceoHonorific }) => `${ceoHonorific}, 프로젝트와 작업 공간의 흐름을 한 장면처럼 이어서 볼 수 있게 정리했어요.`,
    choices: ["프로젝트 보기", "작업 공간 확인", "막힌 일 찾기", "Staff 배치"],
  },
  {
    id: "runtime_room",
    match: ["/execution-workspaces", "/routines", "/dashboard/live"],
    speaker: { characterId: "rika", title: "CTO", name: "Rika" },
    text: ({ ceoHonorific }) => `${ceoHonorific}, 실행 환경과 반복 업무는 제가 안정성부터 확인하겠습니다.`,
    choices: ["런타임 상태", "로그 확인", "루틴 점검", "위험 신호"],
  },
  {
    id: "company_hall",
    match: ["/companies", "/org", "/onboarding"],
    speaker: { characterId: "sera", title: "PM", name: "Sera" },
    text: ({ companyName, ceoHonorific }) => `${ceoHonorific}, ${companyName}의 조직과 회사 흐름이 분명하게 보이도록 정리했어요.`,
    choices: ["회사 선택", "조직도 보기", "Staff 보기", "운영 기록"],
  },
  {
    id: "tool_atelier",
    match: [
      "/skills",
      "/plugins",
      "/instance/settings/adapters",
      "/company/export",
      "/company/import",
      "/search",
      "/design-guide",
      "/u/",
    ],
    speaker: { characterId: "nari", title: "Operations", name: "Nari" },
    text: ({ ceoHonorific }) => `${ceoHonorific}, 도구와 기록은 필요한 순간에 바로 꺼낼 수 있게 정돈해둘게요.`,
    choices: ["도구 확인", "기록 찾기", "내보내기", "안전 점검"],
  },
  {
    id: "settings_atelier",
    match: ["/settings", "/company/settings"],
    speaker: { characterId: "rika", title: "CTO", name: "Rika" },
    text: ({ ceoHonorific }) => `설정은 제가 조용히 정리해둘게요. ${ceoHonorific}의 권한과 안전 장치를 우선하겠습니다.`,
    choices: ["권한", "어댑터", "브랜딩", "보안"],
  },
  {
    id: "office",
    match: ["/dashboard", "/"],
    speaker: { characterId: "sera", title: "PM", name: "Sera" },
    text: ({ companyName, ceoHonorific }) => `좋은 아침이에요, ${ceoHonorific}. ${companyName}의 오늘 상황을 한눈에 볼 수 있게 준비했어요.`,
    choices: ["승인 대기 보기", "실행 상황 보기", "Staff 보기", "예산 확인"],
  },
];

export function resolveKawaiiScene(pathname: string) {
  return kawaiiScenes.find((scene) => scene.match.some((match) => pathname.includes(match))) ?? kawaiiScenes.at(-1)!;
}
