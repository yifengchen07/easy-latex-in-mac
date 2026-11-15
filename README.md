# Easy LaTeX for Word on Mac

在 Word 的任务窗格输入 LaTeX，预览并将公式插入光标所在处。公式的外观由本机 TeX 排版决定。

## 安装和启动

需要 Mac 版 Microsoft Word（支持 WordApi 1.3）、Node.js 22+ 和完整的 MacTeX。Times New Roman 模式使用 macOS 自带字体和 TeX Live 的 TeX Gyre Termes Math。排版还使用 macOS 自带的 `sandbox-exec` 和 `xsltproc`。本机已确认这些依赖可用。

1. 双击 **启动 Easy LaTeX.command**。它会为当前用户注册加载项，并启动本机排版服务。保留打开的终端窗口。
2. 打开 Word 空白文档，选择 **开始 → 加载项 → 开发人员加载项 → Easy LaTeX**。首次安装后如果菜单没有出现，退出 Word 并重新打开。
3. 输入公式、选字体和字号，确认预览后点 **插入公式**。也可以在输入框按 **⌘ Return**。

公式框和导言区下方都有 **复制** 和 **粘贴** 按钮。复制有选区时取选中的文字，否则复制整栏。粘贴会插到光标处，或替换选中的文字。

终端也可以运行 `npm start` 来启动服务。手工安装时，把 `manifest.xml` 复制到 `~/Library/Containers/com.microsoft.Word/Data/Documents/wef/`。加载路径见 [微软的 Mac 版 Word 加载项文档](https://learn.microsoft.com/en-us/office/dev/add-ins/testing/sideload-an-office-add-in-on-mac)。

从第一版升级时，在原来的终端窗口按 **Control+C**，重新双击启动文件，再关闭并重新打开 Word 里的 Easy LaTeX 窗格。

## 使用宏包和自定义命令

第二版由本机 LaTeX 处理命令。行内和行间模式可输入数学表达式，也能直接粘贴完整的 `align`、`gather`、`equation` 等环境。对于 TikZ 或自定义环境，选择 **原样 LaTeX**，再粘贴完整环境。原样模式下，自行用 `\[ … \]` 等定界符进入数学模式。

展开 **导言区**，填写要加载的宏包与自定义命令。例如：

```latex
\usepackage{mathtools,cancel}
\DeclarePairedDelimiter{\abs}{\lvert}{\rvert}
```

然后在公式输入框中使用 `\abs*{\cancel{x^2}+1}`。宏包从本机 MacTeX 的安装目录读取。LaTeX 报错时，窗格会显示编译器返回的信息。

## 排版与编辑

- **Computer Modern** 由 LaTeX 排版，使用经典字形和 AMS 扩展符号。
- **Times New Roman** 由 XeLaTeX 排版，使用本机安装的实际字体排字母、数字和 `\text{}` 中的普通文本。TeX Gyre Termes Math 补足伸缩括号、根号、黑板粗体、花体等字形。
- 字号为 8–36 pt。**行内**和**行间**切换 LaTeX 数学样式，插入位置由 Word 光标决定。独立显示时，先把光标放到单独的段落。有编号的公式在每次插入时独立排版，需要指定编号时可用 `\tag{…}`。
- 点选已经插入的公式，再点 **读取所选公式**。修改后点 **更新所选公式**。源码、导言区、字体、字号和排版模式随公式保存在 `.docx` 中。第一版插入的公式也可以读取。

公式作为嵌入式 SVG 保存，并带有 PNG 备用图。每次生成一张图。命令的可用性取决于本机安装的宏包、所选引擎和 SVG 转换。依赖 LuaLaTeX、外部程序、任意本地文件或跨页文档结构的工作流需在完整的 TeX 工程中运行。

公式源码仅发送到本机 `127.0.0.1:43127`。编译使用独立的临时目录，禁止执行外部命令和访问网络。Word 启动任务窗格时会加载微软的 Office.js。关闭终端后，需要重新启动服务才能继续插入和更新公式。

## 验证

`npm test` 测试两种字体、行内基线、多行环境、宏包、自定义命令、TikZ、文件隔离和源码读回格式。测试需要在 macOS 的普通终端启动，才能启用排版隔离。

在 Word 内可用上面的导言区和公式试插。选中公式后读取，再切换字体并更新，检查公式与导言区是否随文档保存。
