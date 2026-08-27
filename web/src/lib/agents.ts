/** 后端专家 id 到工作台徽章文案。 */

export const AGENT_LABEL: Record<string, string> = {
  supervisor: "Supervisor",
  guide: "Guide",
  planner: "Planner",
  preference: "Preference",
  research: "Research",
  budget: "Budget",
  critic: "Critic",
  writer: "Writer",
};

/**
 * 把后端 agent id 转成徽章文案。
 * @param id 专家 id（string | null | undefined）
 * @returns 展示名（string），未知 id 原样返回
 */
export function agentLabel(id?: string | null): string {
  if (!id) return "";
  return AGENT_LABEL[id] ?? id;
}
