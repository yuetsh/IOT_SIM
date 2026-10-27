<script setup lang="ts">
// 使用说明：学生部分谁都能看（登录页也有入口），老师登录后多出老师部分。从各页顶栏在新标签页打开，不打断正在做的事。
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { currentUser } from '../auth'

/** 点截图在页面上放大看，点任意处或按 Esc 关闭 */
const zoomed = ref<{ src: string; caption: string } | null>(null)

function zoom(event: MouseEvent) {
  const link = event.currentTarget as HTMLAnchorElement
  zoomed.value = { src: link.href, caption: link.closest('figure')?.querySelector('figcaption')?.textContent ?? '' }
}

/** 按窗口大小放大到放得下，小截图最多放大 2 倍（再大就糊了） */
function fit(event: Event) {
  const img = event.target as HTMLImageElement
  const scale = Math.min(2, (window.innerWidth - 32) / img.naturalWidth, (window.innerHeight - 72) / img.naturalHeight)
  img.style.width = `${Math.round(img.naturalWidth * scale)}px`
}

function onKey(event: KeyboardEvent) {
  if (event.key === 'Escape') zoomed.value = null
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
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
        <p>用老师发给你的用户名和密码登录。</p>

        <h3>2. 自由练习和做作业</h3>
        <ul>
          <li>登录后先看到<b>我的作业</b>：老师布置的作业、截止时间和得分；点作业名开始做。做实验时随时可以点右上角的<b>我的作业</b>回来。</li>
          <li>点<b>自由练习</b>：左上角的下拉框选教材上的任务，可以随便改、随便运行；下次打开时回到上次做的任务。</li>
          <li>工具栏的<b>任务</b>：任务目标、控件名、实现步骤和在平台上怎么试，第一次打开一个实验时自动弹出。面板在工具栏下面，可以开着做。</li>
          <li>
            作业的起点有两种：<b>界面已做好</b>（只写事件和代码）、<b>空白工程</b>（从搭界面做起）。控件名照书上的写，自动评分按书上的控件名操作你的程序。
          </li>
        </ul>
        <figure class="shot">
          <a href="/help-img/assignments.webp" title="点击放大" @click.prevent="zoom"><img src="/help-img/assignments.webp" alt="" loading="lazy" /></a>
          <figcaption>我的作业：点作业名开始做，右边是提交状态和得分</figcaption>
        </figure>
        <figure class="shot">
          <a href="/help-img/overview.webp" title="点击放大" @click.prevent="zoom"><img src="/help-img/overview.webp" alt="" loading="lazy" /></a>
          <figcaption>实验页：左边是设计器和代码，右边是运行区（学生程序的窗体）和虚拟实训台</figcaption>
        </figure>
        <figure class="shot">
          <a href="/help-img/task.webp" title="点击放大" @click.prevent="zoom"><img src="/help-img/task.webp" alt="" loading="lazy" /></a>
          <figcaption>任务面板：任务目标、控件名、实现步骤</figcaption>
        </figure>

        <h3>3. 搭界面</h3>
        <ul>
          <li>点 <code>Form1.cs [设计]</code> 标签打开窗体设计器，和 Visual Studio 一样用。</li>
          <li>
            把<b>工具箱</b>里的控件拖到窗体上，或者双击工具箱里的控件：放在选中的分组框、面板（或选中控件所在的容器）左上角，连续双击会依次错开。比窗体还宽的控件（如
            LED 显示屏）会自动缩小到放得下。选中控件后在右边的<b>属性</b>里改名称、文字等。
          </li>
          <li>
            <b>双击窗体上的控件</b>生成它的默认事件（如按钮的单击），并跳到代码；其他事件在 <b>⚡ 事件</b> 里双击事件名。定时器等组件显示在窗体下面的组件栏里。
          </li>
          <li>撤销 Ctrl+Z，重做 Ctrl+Y，删除控件 Delete，方向键微调位置。</li>
        </ul>

        <figure class="shot">
          <a href="/help-img/designer.webp" title="点击放大" @click.prevent="zoom"><img src="/help-img/designer.webp" alt="" loading="lazy" /></a>
          <figcaption>窗体设计器：左边工具箱，中间窗体，右边属性和事件（这里选中了"打开"按钮，它的单击事件是 btn_open_Click）</figcaption>
        </figure>

        <h3>4. 写代码、运行</h3>
        <ul>
          <li><b>F5</b> 或 <b>▶ 运行</b>：编译并运行，窗体显示在右边的运行区；<b>Shift+F5</b> 或 <b>■ 停止</b> 结束程序。</li>
          <li>编译错误显示在窗体下面，点它跳到出错的代码；常见错误会给出中文<b>提示</b>。</li>
          <li>程序运行时出错（比如文本框是空的就转换成数字），窗体下面显示中文说明和出错的文件、行号，点它跳到那一行。</li>
          <li><code>Console.WriteLine</code> 的输出、程序保存的图片（项目 4 的拍照）也显示在窗体下面。</li>
          <li>代码改了 1 秒后自动保存到服务器（工具栏显示"已保存"），换电脑登录也能接着做。</li>
          <li>窗体太大时运行区会按比例缩小；点运行区右上角的<b>放大</b>让运行区占满整个网页，放大后也可以点<b>停止</b>，Esc 或<b>还原</b>回来。</li>
        </ul>

        <figure class="shot">
          <a href="/help-img/error.webp" title="点击放大" @click.prevent="zoom"><img src="/help-img/error.webp" alt="" loading="lazy" /></a>
          <figcaption>运行出错：窗体下面用中文说明原因和出错的行，点它跳到代码</figcaption>
        </figure>

        <h3>5. 虚拟实训台</h3>
        <ul>
          <li>运行区下面是虚拟实训台，代替书上的实物设备。程序打开的串口：COM2 → ADAM-4017+，COM3 → ADAM-4150，COM4 → ZigBee 协调器，COM5 → LED 屏。</li>
          <li>拖动滑块（或点一下滑块再按方向键）调温度、湿度、光照；点人体红外、烟雾、火焰、红外对射切换有无。程序控制的灯、警示灯、LED 屏会跟着变化。</li>
          <li>
            两盏照明灯：<b>照明灯 1</b> 接 ZigBee 继电器节点 1（项目 3 的路灯），<b>照明灯 2</b> 接 ADAM-4150 的 DO1（项目 7 的教室、寝室、会议室）；警示灯接
            ADAM-4150 的 DO0。
          </li>
          <li>时钟可以拨到任意时刻、加快到 10 倍或 60 倍，程序里的 <code>DateTime.Now</code> 跟着它走（情景控制的任务用得到）。</li>
          <li><b>实训台复位</b>：关掉所有灯、清空 LED 屏，传感器回到默认值。<b>收起</b>：实训台缩成一行，给窗体腾地方。</li>
        </ul>

        <figure class="shot">
          <a href="/help-img/board.webp" title="点击放大" @click.prevent="zoom"><img src="/help-img/board.webp" alt="" loading="lazy" /></a>
          <figcaption>虚拟实训台：程序打开了照明灯 2（ADAM-4150 DO1）；拖滑块调温湿度、光照，点卡片切换传感器</figcaption>
        </figure>

        <h3>6. 自己检查、提交</h3>
        <ul>
          <li>
            <b>任务</b
            >面板下面是<b>评价项</b>：这个任务要自动检查哪些功能；点<b>自己检查</b>，平台按评分规则试运行你的程序，告诉你哪项没通过、为什么。不计分，可以检查很多次。
          </li>
          <li>做作业时点<b>提交</b>，平台自动评分，几十秒内出结果（全班同时提交时要排队）。截止前可以改了再交，以最后一次为准。</li>
          <li>点工具栏上的分数，看每一项的得分；老师评阅后，这里能看到老师的打分和评语。</li>
        </ul>

        <figure class="shot">
          <a href="/help-img/check.webp" title="点击放大" @click.prevent="zoom"><img src="/help-img/check.webp" alt="" loading="lazy" /></a>
          <figcaption>任务面板最下面的"自己检查"：逐项显示通过没有</figcaption>
        </figure>
        <figure class="shot">
          <a href="/help-img/result.webp" title="点击放大" @click.prevent="zoom"><img src="/help-img/result.webp" alt="" loading="lazy" /></a>
          <figcaption>提交后点工具栏上的分数看评分结果</figcaption>
        </figure>

        <h3>7. 数据库（项目 6、8）</h3>
        <ul>
          <li>点右上角的<b>数据库</b>（在新标签页打开），代替书上的 SSMS：右键新建数据库、新建表，<b>新建查询</b>写 SQL，按 F5 执行。</li>
          <li>每个人有自己的一套数据库，只有自己能看到，一直保留。程序里的连接字符串只看数据库名，服务器名、账号密码照书上写就行。</li>
          <li>数据弄乱了：点<b>恢复实验初始数据</b>，选实验（默认是刚才做的实验），把这个实验用到的库换回初始数据（其他库不动）。</li>
          <li>点<b>← 返回实验</b>回到刚才做的实验。</li>
        </ul>
        <figure class="shot">
          <a href="/help-img/db.webp" title="点击放大" @click.prevent="zoom"><img src="/help-img/db.webp" alt="" loading="lazy" /></a>
          <figcaption>数据库页面：左边是对象资源管理器，右边写 SQL、按 F5 执行，下面是结果</figcaption>
        </figure>
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

        <figure class="shot">
          <a href="/help-img/students.webp" title="点击放大" @click.prevent="zoom"><img src="/help-img/students.webp" alt="" loading="lazy" /></a>
          <figcaption>班级管理：导入名单后，用户名和密码都在这里，可以导出、重置密码</figcaption>
        </figure>

        <h3>2. 布置作业</h3>
        <ul>
          <li><b>作业</b>标签页 → <b>布置作业</b>：选实验、起点（界面已做好 / 空白工程）、截止时间（可以不限）。</li>
          <li>自动评分项默认每项 10 分；老师评分项（界面、注释、命名）由你在评阅时打分，可以增删、改分值。</li>
          <li><b>任务说明</b>预填实验的说明，可以改写，比如在最前面加一段"这次只做前 3 步"；布置后也能在<b>修改</b>里改。</li>
        </ul>

        <figure class="shot">
          <a href="/help-img/assign.webp" title="点击放大" @click.prevent="zoom"><img src="/help-img/assign.webp" alt="" loading="lazy" /></a>
          <figcaption>布置作业：选实验和起点，自动评分项、任务说明、老师评分项都可以改</figcaption>
        </figure>

        <h3>3. 评阅、成绩</h3>
        <ul>
          <li>作业列表里点<b>评阅</b>：左边是全班学生，右边是选中学生的界面截图、代码、自动评分结果和规范提示。</li>
          <li><b>▶ 运行</b>标签页直接运行学生的程序，可以操作实训台（改动不保存）。</li>
          <li>配置了 AI 评阅时，右边有<b>AI 建议</b>的分数和评语，点<b>采纳 AI 建议</b>填进表单，改好后<b>保存并看下一个</b>。</li>
          <li><b>成绩</b>标签页是全班 × 全部作业的总分，<b>导出成绩表（CSV）</b>用 Excel 打开不乱码。</li>
        </ul>

        <figure class="shot">
          <a href="/help-img/review.webp" title="点击放大" @click.prevent="zoom"><img src="/help-img/review.webp" alt="" loading="lazy" /></a>
          <figcaption>评阅：左边是学生列表，中间看界面截图、运行程序、看代码，右边打分写评语</figcaption>
        </figure>
        <figure class="shot">
          <a href="/help-img/grades.webp" title="点击放大" @click.prevent="zoom"><img src="/help-img/grades.webp" alt="" loading="lazy" /></a>
          <figcaption>成绩：全班 × 全部作业的总分，"待评"表示老师还没打分</figcaption>
        </figure>

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
          <dt>点了运行，只显示"已停止"，没有窗体</dt>
          <dd>代码有编译错误：看运行区窗体下面的红字，点它跳到出错的地方，照着<b>提示</b>改。</dd>
          <dt>窗体上的按钮点了没反应</dt>
          <dd>看运行区有没有显示"与服务器的连接断开了"。断开后程序已经结束，等它自动连上，再按 F5 重新运行。</dd>
          <dt>代码改乱了，想重来</dt>
          <dd>工具栏的<b>恢复原始代码</b>（做作业时是<b>恢复到作业起点</b>）把代码换回起点；已经提交的不受影响。</dd>
          <dt>登录时提示密码输错太多次</dt>
          <dd>同一个账号连续输错 10 次要等 10 分钟，或者请老师在名单里查看、重置密码。</dd>
          <dt>网页打不开、一片空白</dt>
          <dd>换新版的 Chrome 或 Edge</dd>
          <dt>评分说"找不到名为 … 的控件"</dt>
          <dd>控件名要和书上的一样（注意大小写），在设计器的属性里改<b>名称</b>；改名后代码里用到旧名字的地方也要改。</dd>
        </dl>
      </section>
    </main>

    <div v-if="zoomed" class="zoom" @click="zoomed = null">
      <img :src="zoomed.src" alt="" @load="fit" />
      <div class="zoom-caption">{{ zoomed.caption }}（点任意处或按 Esc 关闭）</div>
    </div>
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

/* 截图：按原尺寸显示，比正文宽时缩小；点击在页面上放大 */
.shot {
  margin: 12px 0 16px;
}

.shot img {
  display: block;
  max-width: 100%;
  height: auto;
  border: 1px solid #e5e7eb;
  border-radius: 4px;
  box-shadow: 0 1px 4px rgb(0 0 0 / 0.08);
}

.shot a {
  cursor: zoom-in;
}

.zoom {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 16px;
  background: rgb(0 0 0 / 0.88);
  cursor: zoom-out;
}

.zoom img {
  max-width: 100%;
  border-radius: 4px;
  background: #fff;
}

.zoom-caption {
  color: #fff;
  font-size: 14px;
}

.shot figcaption {
  margin-top: 4px;
  font-size: 13px;
  color: #6b7280;
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
