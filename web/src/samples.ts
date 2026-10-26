// 实验下拉菜单：按教材的项目分组，组名是项目名，组里每项只写"任务N …"；选中后框里显示完整标题
import { h } from 'vue'
import type { SelectGroupOption, SelectOption, SelectRenderTag } from 'naive-ui'

/** 教材 8 个项目的名称（去掉"智慧校园系统——"前缀） */
const PROJECTS: Record<string, string> = {
  1: 'C#入门基础',
  2: '环境监测模块',
  3: '智慧路灯控制模块',
  4: '入侵信息监测模块',
  5: '灾情信息监测模块',
  6: '数据存储模块',
  7: '情景控制模块',
  8: '智慧校园管理平台',
}

/** 实验标题形如"项目3 任务2 人来灯亮"，按项目分组；不是这种格式的放进"其他" */
export function sampleOptions(list: { id: string; title: string }[]): SelectGroupOption[] {
  const groups = new Map<string, SelectGroupOption & { children: SelectOption[] }>()
  for (const s of list) {
    const m = /^项目(\d+)\s*(.*)$/.exec(s.title)
    const key = m ? m[1]! : '其他'
    let group = groups.get(key)
    if (!group) {
      group = { type: 'group', key, label: m ? `项目${key} ${PROJECTS[key] ?? ''}`.trim() : '其他', children: [] }
      groups.set(key, group)
    }
    group.children.push({ label: m ? m[2] : s.title, value: s.id, title: s.title })
  }
  return [...groups.values()]
}

/** 选择框里显示完整标题（带项目号），下拉列表里仍是简短的"任务N …" */
export const renderSampleTag: SelectRenderTag = ({ option }) => h('span', { title: option.title as string }, option.title as string)
