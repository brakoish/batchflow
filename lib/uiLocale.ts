export const zh: Record<string, string> = {
  'End your shift?': '结束当前班次吗？', 'Record': '记录', 'Products': '产品',
  'Enter': '输入', 'Safe to log': '可安全记录', 'Enter amount': '输入数量', 'Add note': '添加备注', 'Saving...': '正在保存…', 'Save Changes': '保存更改', 'ON SHIFT': '已上班', 'OFF SHIFT': '未上班', 'Checking shift…': '正在检查班次…', 'Connection error — save not confirmed. Your draft is retained. Check recent logs before retrying.': '连接错误——尚未确认保存。输入已保留，请检查最近记录后再重试。',
  'Home': '首页', 'Batches': '批次', 'Recipes': '配方', 'Analytics': '分析', 'Organization': '组织', 'Org': '组织',
  'Stock': '库存', 'Current Stock': '当前库存', 'Shift': '班次', 'My Day': '我的今日', 'More': '更多', 'Tools': '工具',
  'Batch history': '批次历史', 'Announcements': '通知', 'My timesheet': '我的工时表', 'Employee reminders': '员工提醒',
  'Clock In': '上班打卡', 'Clock Out': '下班打卡', 'On Shift': '已上班', 'Off Shift': '未上班', 'Confirm': '确认', 'Cancel': '取消', 'Close': '关闭',
  'Team member': '团队成员', 'Supervisor': '主管', 'Owner': '管理员', 'Account': '账户', 'Sign Out': '退出登录',
  'In Progress': '进行中', 'Ready to Touch': '可开始', 'Waiting on Product': '等待上道工序', 'Waiting': '等待中', 'Ready': '已就绪', 'Active': '进行中', 'Done': '已完成',
  'Log': '记录', 'Log Progress': '记录进度', 'Quantity': '数量', 'Add Note': '添加备注', 'Save': '保存', 'Submit': '提交', 'Complete': '完成', 'Mark Done': '标记完成',
  'Today': '今天', 'Units Today': '今日数量', 'Hours Today': '今日工时', 'Batches Worked Today': '今日参与批次', 'This Week': '本周', 'Timesheet →': '工时表 →',
  'Total Units': '总数量', 'Units/Hour': '每小时数量', 'Hours': '工时', 'Day Streak': '连续工作天数',
  'No activity logged today yet': '今天尚无记录', 'Start working on batches to see your stats': '开始处理批次后即可查看统计',
  'Clock in to start tracking your time': '上班打卡后开始记录工时', 'Starting...': '正在开始…', 'Starting…': '正在开始…', 'Clocking out…': '正在下班打卡…',
  'Preferred language': '首选语言', 'English': '英语', 'Simplified Chinese': '简体中文', 'Language saved': '语言已保存',
  'Search batches...': '搜索批次…', 'No batches': '没有批次', 'No batches match': '没有匹配的批次', 'Try a different search term.': '请尝试其他搜索词。',
  'Production Line': '生产线', 'Batch Inventory': '批次库存', 'Produced': '已生产', 'Removed': '已移出', 'On hand': '现有库存', 'Recent activity': '最近活动',
  'Show recent logs': '显示最近记录', 'Hide recent logs': '隐藏最近记录', 'Note (optional)': '备注（可选）', 'Connection error': '连接错误',
}

export function translateUi(value: string, language = 'en') {
  if (language !== 'zh-CN') return value
  const exact = zh[value]
  if (exact) return exact
  if (/^Hey .+!$/.test(value)) return value.replace(/^Hey (.+)!$/, '你好，$1！')
  if (/^Started at /.test(value)) return value.replace(/^Started at /, '上班时间：')
  if (/^Needs .+ more from /.test(value)) return value.replace(/^Needs (.+) more from (.+)$/, '还需要 $1，来自 $2')
  if (/^Show \d+ recent logs?$/.test(value)) return value.replace(/^Show (\d+) recent logs?$/, '显示 $1 条最近记录')
  if (/^\d+ units$/.test(value)) return value.replace(' units', ' 个')
  if (value.startsWith('Record measurement in ')) return value.replace('Record measurement in ', '记录测量值，单位：')
  if (/^(Recorded|Logged) /.test(value)) return value.replace(/^(Recorded|Logged) /, '已记录 ')
  return value
}
