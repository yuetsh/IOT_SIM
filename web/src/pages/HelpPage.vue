<script setup lang="ts">
// 使用说明：学生部分谁都能看（登录页也有入口），老师登录后多出老师部分。从各页顶栏在新标签页打开，不打断正在做的事。
import { RouterLink } from 'vue-router'
import { currentUser } from '../auth'
</script>

<template>
  <div class="page">
    <header class="toolbar">
      <strong>物联网编程仿真平台</strong>
      <span class="title">使用说明</span>
      <span class="spacer" />
      <RouterLink :to="currentUser ? '/' : '/login'" class="nav-link">{{ currentUser ? '返回实验' : '登录' }}</RouterLink>
    </header>

    <main class="content">
      <nav class="toc">
        <a href="#student">学生</a>
        <a v-if="currentUser?.role === 'teacher'" href="#teacher">老师</a>
        <a href="#faq">常见问题</a>
      </nav>

      <section id="student">
        <h2>学生</h2>

        <h3>1. 登录</h3>
        <p>用老师发给你的用户名和密码登录。请用新版的 Chrome 或 Edge 浏览器；用 360、QQ 浏览器时，点地址栏右边的闪电图标切换到<b>极速模式</b>。</p>

        <h3>2. 自由练习和做作业</h3>
        <ul>
          <li>登录后进入<b>自由练习</b>：左上角的下拉框选教材上的任务，可以随便改、随便运行。</li>
          <li>点右上角的<b>我的作业</b>，看老师布置的作业、截止时间和得分；点作业名开始做。</li>
          <li>工具栏的<b>任务</b>：任务目标、控件名、实现步骤和在平台上怎么试，第一次打开一个实验时自动弹出。面板不挡住设计器和代码，可以开着做。</li>
          <li>
            作业的起点有两种：<b>界面已做好</b>（只写事件和代码）、<b>空白工程</b>（从搭界面做起）。控件名照书上的写，自动评分按书上的控件名操作你的程序。
          </li>
        </ul>

        <h3>3. 搭界面</h3>
        <ul>
          <li>点 <code>Form1.cs [设计]</code> 标签打开窗体设计器，和 Visual Studio 一样用。</li>
          <li>把<b>工具箱</b>里的控件拖到窗体上（或双击控件）；选中控件后在右边的<b>属性</b>里改名称、文字等。</li>
          <li>
            <b>双击窗体上的控件</b>生成它的默认事件（如按钮的单击），并跳到代码；其他事件在 <b>⚡ 事件</b> 里双击事件名。定时器等组件显示在窗体下面的组件栏里。
          </li>
          <li>撤销 Ctrl+Z，重做 Ctrl+Y，删除控件 Delete，方向键微调位置。</li>
        </ul>

        <h3>4. 写代码、运行</h3>
        <ul>
          <li><b>F5</b> 或 <b>▶ 运行</b>：编译并运行，窗体显示在右边的运行区；<b>Shift+F5</b> 或 <b>■ 停止</b> 结束程序。</li>
          <li>有编译错误时，错误显示在实训台下面，点它跳到出错的代码；常见错误会给出中文<b>提示</b>。</li>
          <li>代码改了 1 秒后自动保存到服务器（工具栏显示"已保存"），换电脑登录也能接着做。</li>
          <li>窗体太大时运行区会按比例缩小；点<b>放大</b>让运行区占满整个网页，Esc 还原。</li>
        </ul>

        <h3>5. 虚拟实训台</h3>
        <ul>
          <li>运行区下面是虚拟实训台，代替书上的实物设备。程序打开的串口：COM2 → ADAM-4017+，COM3 → ADAM-4150，COM4 → ZigBee 协调器，COM5 → LED 屏。</li>
          <li>拖动滑块调温度、湿度、光照；点人体红外、烟雾、火焰、红外对射切换有无。程序控制的灯、警示灯、LED 屏会跟着变化。</li>
          <li>时钟可以拨到任意时刻、加快到 10 倍或 60 倍，程序里的 <code>DateTime.Now</code> 跟着它走（情景控制的任务用得到）。</li>
          <li><b>实训台复位</b>：关掉所有灯、清空 LED 屏，传感器回到默认值。<b>收起</b>：实训台缩成一行，给窗体腾地方。</li>
        </ul>

        <h3>6. 自己检查、提交</h3>
        <ul>
          <li>
            <b>任务</b
            >面板下面是<b>评价项</b>：这个任务要自动检查哪些功能；点<b>自己检查</b>，平台按评分规则试运行你的程序，告诉你哪项没通过、为什么。不计分，可以检查很多次。
          </li>
          <li>做作业时点<b>提交</b>，平台自动评分，几十秒内出结果（全班同时提交时要排队）。截止前可以改了再交，以最后一次为准。</li>
          <li>点工具栏上的分数，看每一项的得分；老师评阅后，这里能看到老师的打分和评语。</li>
        </ul>

        <h3>7. 数据库（项目 6、8）</h3>
        <ul>
          <li>点右上角的<b>数据库</b>（在新标签页打开），代替书上的 SSMS：右键新建数据库、新建表，<b>新建查询</b>写 SQL，按 F5 执行。</li>
          <li>每个人有自己的一套数据库，只有自己能看到，一直保留。程序里的连接字符串只看数据库名，服务器名、账号密码照书上写就行。</li>
          <li>数据弄乱了：点<b>恢复实验初始数据</b>，选实验，把这个实验用到的库换回初始数据（其他库不动）。</li>
        </ul>
      </section>

      <section v-if="currentUser?.role === 'teacher'" id="teacher">
        <h2>老师</h2>

        <h3>1. 建班、导入名单</h3>
        <ul>
          <li>右上角<b>班级管理</b> → <b>班级 ＋ 新建</b>，输入班级名。</li>
          <li>
            <b>学生</b>标签页 → <b>导入名单（CSV）</b>。CSV 两列：用户名、密码（可以点<b>下载名单模板</b>），用户名就是学生姓名，前面带的班级代号（如
            ks241）会自动去掉；Excel 另存为 CSV 即可，GBK、UTF-8 都行。密码留空时自动生成 6 位数字。
          </li>
          <li>导入后点<b>导出名单（含密码）</b>，打印或发给学生。学生忘了密码，在名单里点<b>重置密码</b>。</li>
        </ul>

        <h3>2. 布置作业</h3>
        <ul>
          <li><b>作业</b>标签页 → <b>布置作业</b>：选实验、起点（界面已做好 / 空白工程）、截止时间（可以不限）。</li>
          <li>自动评分项默认每项 10 分；老师评分项（界面、注释、命名）由你在评阅时打分，可以增删、改分值。</li>
          <li><b>任务说明</b>预填实验的说明，可以改写，比如在最前面加一段"这次只做前 3 步"；布置后也能在<b>修改</b>里改。</li>
        </ul>

        <h3>3. 评阅、成绩</h3>
        <ul>
          <li>作业列表里点<b>评阅</b>：左边是全班学生，右边是选中学生的界面截图、代码、自动评分结果和规范提示。</li>
          <li><b>▶ 运行</b>标签页直接运行学生的程序，可以操作实训台（改动不保存）。</li>
          <li>配置了 AI 评阅时，右边有<b>AI 建议</b>的分数和评语，点<b>采纳 AI 建议</b>填进表单，改好后<b>保存并看下一个</b>。</li>
          <li><b>成绩</b>标签页是全班 × 全部作业的总分，<b>导出成绩表（CSV）</b>用 Excel 打开不乱码。</li>
        </ul>

        <h3>4. 上课前后</h3>
        <ul>
          <li>第一次用之前，让学生提前打开一次网站：实验页第一次打开要下载约 1.5 MB，之后浏览器会缓存；全班同时第一次打开时会慢一些。</li>
          <li>上课时间不要更新平台（推送代码）：更新会重启平台，正在运行的学生程序会结束（页面会提示并自动重连）。</li>
          <li>全班同时"自己检查"或提交时要排队，项目 8 这种大任务最后一个人大约等 1.5 分钟。</li>
          <li>重要节点前后备份数据：在服务器上执行 <code>deploy/backup.sh</code>（说明见 deploy/README.md）。</li>
        </ul>
      </section>

      <section id="faq">
        <h2>常见问题</h2>
        <dl>
          <dt>窗体上的按钮点了没反应</dt>
          <dd>看运行区有没有显示"与服务器的连接断开了"。断开后程序已经结束，等它自动连上，再按 F5 重新运行。</dd>
          <dt>代码改乱了，想重来</dt>
          <dd>工具栏的<b>恢复原始代码</b>（做作业时是<b>恢复到作业起点</b>）把代码换回起点；已经提交的不受影响。</dd>
          <dt>登录时提示密码输错太多次</dt>
          <dd>同一个账号连续输错 10 次要等 10 分钟，或者请老师在名单里查看、重置密码。</dd>
          <dt>网页打不开、一片空白</dt>
          <dd>换新版的 Chrome 或 Edge；360、QQ 浏览器切换到极速模式。</dd>
          <dt>评分说"找不到名为 … 的控件"</dt>
          <dd>控件名要和书上的一样（注意大小写），在设计器的属性里改<b>名称</b>；改名后代码里用到旧名字的地方也要改。</dd>
        </dl>
      </section>
    </main>
  </div>
</template>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

.toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 16px;
  border-bottom: 1px solid #e5e7eb;
}

.title {
  color: #374151;
}

.spacer {
  flex: 1;
}

.nav-link,
.toc a {
  color: #2563eb;
  font-size: 14px;
  text-decoration: none;
}

.content {
  width: 100%;
  max-width: 800px;
  margin: 0 auto;
  padding: 16px 16px 64px;
  box-sizing: border-box;
  font-size: 15px;
  line-height: 1.8;
  color: #1f2937;
}

.toc {
  display: flex;
  gap: 16px;
  margin-bottom: 8px;
}

h2 {
  margin: 32px 0 8px;
  padding-bottom: 4px;
  border-bottom: 1px solid #e5e7eb;
  font-size: 20px;
}

h3 {
  margin: 20px 0 4px;
  font-size: 16px;
}

p,
ul {
  margin: 4px 0;
}

ul {
  padding-left: 22px;
}

code {
  padding: 0 4px;
  border-radius: 3px;
  background: #f3f4f6;
  font-size: 13px;
}

dt {
  margin-top: 12px;
  font-weight: 600;
}

dd {
  margin: 0 0 0 22px;
}

@media print {
  .toolbar,
  .toc {
    display: none;
  }
}
</style>
