# Easy LaTeX for Word on Mac

在 Word 的任务窗格输入 LaTeX，预览并将公式插入光标所在处。公式的外观由本机 TeX 排版决定。

## 安装和启动

需要 Mac 版 Microsoft Word（支持 WordApi 1.3）、Node.js 22+ 和 MacTeX（含 `latex`、`xelatex`、`dvisvgm` 和 `unicode-math`）。Times New Roman 模式使用 macOS 自带字体和 TeX Live 的 TeX Gyre Termes Math。本机已确认这些依赖可用。

1. 双击 **启动 Easy LaTeX.command**。它会为当前用户注册加载项，并启动本机排版服务。保留打开的终端窗口。
2. 打开 Word 空白文档，选择 **开始 → 加载项 → 开发人员加载项 → Easy LaTeX**。首次安装后如果菜单没有出现，退出 Word 并重新打开。
3. 输入公式、选字体和字号，确认预览后点 **插入公式**。也可以在输入框按 **⌘ Return**。

终端也可以运行 `npm start` 来启动服务。手工安装时，把 `manifest.xml` 复制到 `~/Library/Containers/com.microsoft.Word/Data/Documents/wef/`。加载路径见 [微软的 Mac 版 Word 加载项文档](https://learn.microsoft.com/en-us/office/dev/add-ins/testing/sideload-an-office-add-in-on-mac)。

## 排版与编辑

- **Computer Modern** 使用经典 LaTeX 数学字形，扩展符号由 AMS 字体提供。
- **Times New Roman** 使用本机安装的实际字体排版数学字母、数字和 `\text{}` 中的普通文本。伸缩括号、根号等由 TeX Gyre Termes Math 排版。后者也用于黑板粗体、花体等数学字母变体。
- 可输入分式、积分、矩阵、分段函数和 `aligned` 多行公式。字号为 8–36 pt。**行内**和**行间**切换 LaTeX 数学样式，插入位置始终由 Word 光标决定。独立显示时，先把光标放到单独的段落。
- 点选已经插入的公式，再点 **读取所选公式**。修改后点 **更新所选公式**。LaTeX 源码和排版设置保存在 `.docx` 的图片元数据中。

公式作为嵌入式 SVG 保存，并带有 PNG 备用图。接收者可直接查看和打印。需要改公式结构时，通过本加载项修改 LaTeX 源码。第一版支持常用数学命令和环境，整篇 LaTeX 文档、导入宏包和自定义宏暂未支持。

公式源码仅发送到本机 `127.0.0.1:43127`。Word 启动任务窗格时会加载微软的 Office.js。关闭终端后，需要重新启动服务才能继续插入和更新公式。

## 验证

`npm test` 测试常用 LaTeX 输入、两种字体的实际排版、行内基线和公式源码的保存格式。

Word 内验收可以使用 `\frac{x_i+\alpha}{\sqrt{1+y^2}}`。插入后选中公式，读取源码，切换字体后更新，再保存并重新打开文档进行检查。
