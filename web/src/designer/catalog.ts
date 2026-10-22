// 设计器支持的控件：工具箱分组、属性窗口里的属性、事件窗口里的事件、拖入窗体时的初始属性。
// 只列出仿真运行时已经实现的控件和属性；默认值与 WinForms 一致（等于默认值的属性不写进 Designer.cs）。
import type { Value } from './values'

export type PropType = 'string' | 'multiline' | 'bool' | 'int' | 'char' | 'point' | 'size' | 'color' | 'font' | 'enum' | 'items'

export interface PropDef {
  /** WinForms 的属性名，写进 Designer.cs，代码里也用它 */
  name: string
  /** 属性窗口里显示的中文名 */
  label: string
  /** 鼠标悬停时显示的用途说明 */
  description: string
  type: PropType
  /** 枚举属性的完整类型名和可选值 */
  enumType?: string
  options?: string[]
  /** 枚举选项的中文名（写进 Designer.cs 的仍是英文值） */
  optionLabels?: Record<string, string>
  /** 等于这个值时不写进 Designer.cs（WinForms 的默认值） */
  default?: Value
  category: '外观' | '行为' | '布局' | '数据'
}

export interface EventDef {
  /** WinForms 的事件名，事件处理方法的名字也用它（如 button1_Click） */
  name: string
  /** 事件窗口里显示的中文名 */
  label: string
  delegate: string
  /** 事件处理方法第二个参数的类型 */
  args: string
}

export interface ControlDef {
  /** 完整类型名，如 System.Windows.Forms.Button */
  type: string
  /** 工具箱和属性窗口里显示的中文名（英文类名在鼠标悬停时显示） */
  label: string
  group: '常用控件' | '容器' | '组件' | '物联网设备'
  /** 新控件的名字前缀：button → button1 */
  namePrefix: string
  /** 非可视组件（如 Timer）：不在窗体上，显示在窗体下方的组件栏 */
  component?: boolean
  container?: boolean
  /** 双击控件时生成的事件 */
  defaultEvent: string
  props: PropDef[]
  events: EventDef[]
  /** 拖入窗体时写入的属性（不含 Location、Name、TabIndex，这些由设计器填写） */
  initial: (name: string) => [string, Value][]
  /** AutoSize 时根据文字计算大小 */
  autoSize?: (text: string) => { width: number; height: number }
}

const str = (value: string): Value => ({ kind: 'string', value })
const bool = (value: boolean): Value => ({ kind: 'bool', value })
const int = (value: number): Value => ({ kind: 'int', value })
const size = (width: number, height: number): Value => ({ kind: 'size', width, height })
const enumValue = (type: string, member: string): Value => ({ kind: 'enum', type, member })

const EVENT = { delegate: 'System.EventHandler', args: 'EventArgs' }
const MOUSE = { delegate: 'System.Windows.Forms.MouseEventHandler', args: 'MouseEventArgs' }

const COMMON_PROPS: PropDef[] = [
  { name: 'Text', label: '文字', description: '控件上显示的文字', type: 'string', default: str(''), category: '外观' },
  { name: 'BackColor', label: '背景色', description: '背景色', type: 'color', category: '外观' },
  { name: 'ForeColor', label: '文字颜色', description: '前景色（文字颜色）', type: 'color', category: '外观' },
  { name: 'Font', label: '字体', description: '字体', type: 'font', category: '外观' },
  { name: 'Location', label: '位置', description: '左上角的坐标（相对于所在的窗体或分组框）', type: 'point', category: '布局' },
  { name: 'Size', label: '大小', description: '宽度和高度（像素）', type: 'size', category: '布局' },
  { name: 'Enabled', label: '可用', description: '是否可用', type: 'bool', default: bool(true), category: '行为' },
  { name: 'Visible', label: '可见', description: '是否可见', type: 'bool', default: bool(true), category: '行为' },
  { name: 'TabIndex', label: 'Tab 顺序', description: 'Tab 键顺序', type: 'int', category: '行为' },
]

const COMMON_EVENTS: EventDef[] = [
  { name: 'Click', label: '单击', ...EVENT },
  { name: 'DoubleClick', label: '双击', ...EVENT },
  { name: 'MouseDown', label: '鼠标按下', ...MOUSE },
  { name: 'MouseUp', label: '鼠标松开', ...MOUSE },
  { name: 'MouseEnter', label: '鼠标进入', ...EVENT },
  { name: 'MouseLeave', label: '鼠标离开', ...EVENT },
  { name: 'TextChanged', label: '文字改变', ...EVENT },
  { name: 'Enter', label: '获得焦点', ...EVENT },
  { name: 'Leave', label: '失去焦点', ...EVENT },
]

const AUTO_SIZE: PropDef = { name: 'AutoSize', label: '自动大小', description: '根据文字自动调整大小', type: 'bool', default: bool(false), category: '布局' }

/** 宋体 9pt 下文字的大致宽度：半角约 6 像素，全角约 12 像素（与 VS 设计器算出的 Size 接近） */
export function textWidth(text: string) {
  let width = 0
  for (const ch of text) width += ch.charCodeAt(0) > 0xff ? 12 : 6
  return width
}

const FORMS = 'System.Windows.Forms'

export const CONTROLS: ControlDef[] = [
  {
    type: `${FORMS}.Button`,
    label: '按钮',
    group: '常用控件',
    namePrefix: 'button',
    defaultEvent: 'Click',
    props: [...COMMON_PROPS],
    events: COMMON_EVENTS,
    initial: (name) => [['Size', size(75, 23)], ['Text', str(name)], ['UseVisualStyleBackColor', bool(true)]],
  },
  {
    type: `${FORMS}.Label`,
    label: '标签',
    group: '常用控件',
    namePrefix: 'label',
    defaultEvent: 'Click',
    props: [...COMMON_PROPS, AUTO_SIZE, {
      name: 'BorderStyle', label: '边框', description: '边框', type: 'enum', enumType: `${FORMS}.BorderStyle`,
      options: ['None', 'FixedSingle', 'Fixed3D'], optionLabels: { None: '无', FixedSingle: '单线', Fixed3D: '立体' }, default: enumValue(`${FORMS}.BorderStyle`, 'None'), category: '外观',
    }],
    events: COMMON_EVENTS,
    initial: (name) => [['AutoSize', bool(true)], ['Size', size(textWidth(name) + 5, 12)], ['Text', str(name)]],
    autoSize: (text) => ({ width: textWidth(text) + 5, height: 12 }),
  },
  {
    type: `${FORMS}.TextBox`,
    label: '文本框',
    group: '常用控件',
    namePrefix: 'textBox',
    defaultEvent: 'TextChanged',
    props: [
      ...COMMON_PROPS.map((p) => (p.name === 'Text' ? { ...p, type: 'multiline' as const } : p)),
      { name: 'Multiline', label: '多行', description: '多行', type: 'bool', default: bool(false), category: '行为' },
      { name: 'ReadOnly', label: '只读', description: '只读', type: 'bool', default: bool(false), category: '行为' },
      { name: 'PasswordChar', label: '密码字符', description: '输入时用这个字符代替显示的内容，如 *', type: 'char', category: '行为' },
      { name: 'UseSystemPasswordChar', label: '系统密码字符', description: '用系统密码字符显示', type: 'bool', default: bool(false), category: '行为' },
      {
        name: 'ScrollBars', label: '滚动条', description: '滚动条', type: 'enum', enumType: `${FORMS}.ScrollBars`,
        options: ['None', 'Horizontal', 'Vertical', 'Both'], optionLabels: { None: '无', Horizontal: '水平', Vertical: '垂直', Both: '水平和垂直' }, default: enumValue(`${FORMS}.ScrollBars`, 'None'), category: '外观',
      },
    ],
    events: COMMON_EVENTS,
    initial: () => [['Size', size(100, 21)]],
  },
  {
    type: `${FORMS}.ComboBox`,
    label: '下拉框',
    group: '常用控件',
    namePrefix: 'comboBox',
    defaultEvent: 'SelectedIndexChanged',
    props: [
      ...COMMON_PROPS,
      { name: 'Items', label: '列表项', description: '下拉列表里的选项，每行一项', type: 'items', category: '数据' },
      {
        name: 'DropDownStyle', label: '下拉样式', description: '下拉样式', type: 'enum', enumType: `${FORMS}.ComboBoxStyle`,
        options: ['DropDown', 'DropDownList', 'Simple'], optionLabels: { DropDown: '可输入的下拉框', DropDownList: '只能选择的下拉列表', Simple: '始终展开' }, default: enumValue(`${FORMS}.ComboBoxStyle`, 'DropDown'), category: '外观',
      },
    ],
    events: [...COMMON_EVENTS, { name: 'SelectedIndexChanged', label: '选中项改变', ...EVENT }, { name: 'DropDown', label: '展开列表', ...EVENT }],
    initial: () => [['FormattingEnabled', bool(true)], ['Size', size(121, 20)]],
  },
  {
    type: `${FORMS}.CheckBox`,
    label: '复选框',
    group: '常用控件',
    namePrefix: 'checkBox',
    defaultEvent: 'CheckedChanged',
    props: [...COMMON_PROPS, AUTO_SIZE, { name: 'Checked', label: '勾选', description: '是否勾选', type: 'bool', default: bool(false), category: '外观' }],
    events: [...COMMON_EVENTS, { name: 'CheckedChanged', label: '勾选状态改变', ...EVENT }],
    initial: (name) => [['AutoSize', bool(true)], ['Size', size(textWidth(name) + 24, 16)], ['Text', str(name)], ['UseVisualStyleBackColor', bool(true)]],
    autoSize: (text) => ({ width: textWidth(text) + 24, height: 16 }),
  },
  {
    type: `${FORMS}.RadioButton`,
    label: '单选按钮',
    group: '常用控件',
    namePrefix: 'radioButton',
    defaultEvent: 'CheckedChanged',
    props: [...COMMON_PROPS, AUTO_SIZE, { name: 'Checked', label: '选中', description: '是否选中', type: 'bool', default: bool(false), category: '外观' }],
    events: [...COMMON_EVENTS, { name: 'CheckedChanged', label: '选中状态改变', ...EVENT }],
    initial: (name) => [['AutoSize', bool(true)], ['Size', size(textWidth(name) + 17, 16)], ['Text', str(name)], ['UseVisualStyleBackColor', bool(true)]],
    autoSize: (text) => ({ width: textWidth(text) + 17, height: 16 }),
  },
  {
    type: `${FORMS}.GroupBox`,
    label: '分组框',
    group: '容器',
    namePrefix: 'groupBox',
    container: true,
    defaultEvent: 'Enter',
    props: [...COMMON_PROPS],
    events: COMMON_EVENTS,
    initial: (name) => [['Size', size(200, 100)], ['TabStop', bool(false)], ['Text', str(name)]],
  },
  {
    type: `${FORMS}.Panel`,
    label: '面板',
    group: '容器',
    namePrefix: 'panel',
    container: true,
    defaultEvent: 'Click',
    props: COMMON_PROPS.filter((p) => p.name !== 'Text'),
    events: COMMON_EVENTS.filter((e) => e.name !== 'TextChanged'),
    initial: () => [['Size', size(200, 100)]],
  },
  {
    type: `${FORMS}.Timer`,
    label: '定时器',
    group: '组件',
    namePrefix: 'timer',
    component: true,
    defaultEvent: 'Tick',
    props: [
      { name: 'Interval', label: '间隔', description: '每隔多少毫秒触发一次"计时到"事件', type: 'int', default: int(100), category: '行为' },
      { name: 'Enabled', label: '启用', description: '程序启动后是否立即开始计时；也可以在代码里调用 Start()', type: 'bool', default: bool(false), category: '行为' },
    ],
    events: [{ name: 'Tick', label: '计时到', ...EVENT }],
    initial: () => [],
  },
  {
    type: 'WinFormsDeviceControlLibrary.LED',
    label: 'LED 显示屏',
    group: '物联网设备',
    namePrefix: 'led',
    defaultEvent: 'Load',
    props: COMMON_PROPS.filter((p) => p.name !== 'Text'),
    events: [{ name: 'Load', label: '加载', ...EVENT }, ...COMMON_EVENTS.filter((e) => e.name !== 'TextChanged')],
    initial: () => [['Size', size(800, 130)]],
  },
  {
    type: 'WinFormsDeviceControlLibrary.Lamp',
    label: '灯泡',
    group: '物联网设备',
    namePrefix: 'lamp',
    defaultEvent: 'Load',
    props: COMMON_PROPS.filter((p) => p.name !== 'Text'),
    events: [{ name: 'Load', label: '加载', ...EVENT }, ...COMMON_EVENTS.filter((e) => e.name !== 'TextChanged')],
    initial: () => [['BackColor', { kind: 'color', css: '#ffffff', name: 'White', r: 255, g: 255, b: 255, a: 255 }], ['Size', size(105, 185)]],
  },
  {
    type: 'WinFormsDeviceControlLibrary.Alarm',
    label: '报警灯',
    group: '物联网设备',
    namePrefix: 'alarm',
    defaultEvent: 'Load',
    props: COMMON_PROPS.filter((p) => p.name !== 'Text'),
    events: [{ name: 'Load', label: '加载', ...EVENT }, ...COMMON_EVENTS.filter((e) => e.name !== 'TextChanged')],
    initial: () => [['Size', size(150, 150)]],
  },
]

/** 窗体本身 */
export const FORM_DEF: ControlDef = {
  type: `${FORMS}.Form`,
  label: '窗体',
  group: '容器',
  namePrefix: 'Form',
  container: true,
  defaultEvent: 'Load',
  props: [
    { name: 'Text', label: '标题', description: '标题栏文字', type: 'string', default: str(''), category: '外观' },
    { name: 'BackColor', label: '背景色', description: '背景色', type: 'color', category: '外观' },
    { name: 'ForeColor', label: '文字颜色', description: '前景色（文字颜色）', type: 'color', category: '外观' },
    { name: 'Font', label: '字体', description: '字体', type: 'font', category: '外观' },
    { name: 'ClientSize', label: '窗口大小', description: '窗口内部的宽度和高度（不含标题栏和边框）', type: 'size', category: '布局' },
    {
      name: 'FormBorderStyle', label: '边框样式', description: '边框样式', type: 'enum', enumType: `${FORMS}.FormBorderStyle`,
      options: ['None', 'FixedSingle', 'Fixed3D', 'FixedDialog', 'Sizable', 'FixedToolWindow', 'SizableToolWindow'],
      optionLabels: { None: '无边框', FixedSingle: '固定单线', Fixed3D: '固定立体', FixedDialog: '对话框', Sizable: '可调整大小', FixedToolWindow: '固定工具窗口', SizableToolWindow: '可调整工具窗口' },
      default: enumValue(`${FORMS}.FormBorderStyle`, 'Sizable'), category: '外观',
    },
    {
      name: 'StartPosition', label: '启动位置', description: '启动位置', type: 'enum', enumType: `${FORMS}.FormStartPosition`,
      options: ['Manual', 'CenterScreen', 'WindowsDefaultLocation', 'WindowsDefaultBounds', 'CenterParent'],
      optionLabels: { Manual: '手动指定', CenterScreen: '屏幕中央', WindowsDefaultLocation: '系统默认位置', WindowsDefaultBounds: '系统默认位置和大小', CenterParent: '父窗体中央' },
      default: enumValue(`${FORMS}.FormStartPosition`, 'WindowsDefaultLocation'), category: '布局',
    },
    { name: 'MaximizeBox', label: '最大化按钮', description: '显示最大化按钮', type: 'bool', default: bool(true), category: '外观' },
    { name: 'MinimizeBox', label: '最小化按钮', description: '显示最小化按钮', type: 'bool', default: bool(true), category: '外观' },
  ],
  events: [
    { name: 'Load', label: '加载', ...EVENT },
    { name: 'Shown', label: '显示后', ...EVENT },
    { name: 'FormClosing', label: '关闭前', delegate: `${FORMS}.FormClosingEventHandler`, args: 'FormClosingEventArgs' },
    { name: 'FormClosed', label: '关闭后', delegate: `${FORMS}.FormClosedEventHandler`, args: 'FormClosedEventArgs' },
    { name: 'Activated', label: '激活', ...EVENT },
    ...COMMON_EVENTS.filter((e) => e.name !== 'TextChanged'),
  ],
  initial: () => [],
}

const BY_TYPE = new Map(CONTROLS.map((def) => [def.type, def]))

/** 按类型名查控件定义；设计器不认识的类型（如 PictureBox）返回一个只有通用属性的定义 */
export function controlDef(type: string): ControlDef {
  return (
    BY_TYPE.get(type) ?? {
      type,
      label: type.split('.').at(-1)!,
      group: '常用控件',
      namePrefix: type.split('.').at(-1)!.replace(/^./, (c) => c.toLowerCase()),
      defaultEvent: 'Click',
      props: COMMON_PROPS,
      events: COMMON_EVENTS,
      initial: () => [],
    }
  )
}

/** 设计器里会重新排列子控件的容器类型 */
export function isContainerType(type: string) {
  return type === FORM_DEF.type || controlDef(type).container === true
}
