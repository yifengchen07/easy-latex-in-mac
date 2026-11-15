# Easy LaTeX · Mac 版 Word 公式加载项

在 Mac 版 Word 的侧栏输入 LaTeX，实时预览，再把公式插到光标处。适合在课程作业、论文和报告中使用 **Computer Modern** 或 **Times New Roman** 排版公式。

公式保存为 Word 文档内的 SVG 矢量图，并带有 PNG 备用图。LaTeX 源码和导言区随公式保存在 `.docx` 中，可在加载项里读回并修改。

## 1. 准备环境

| 需要什么                                 | 如何安装或确认                                                                                                                                                                                           |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Mac 版 Microsoft Word 桌面应用** | 在 Word 的 **开始** 选项卡找到 **加载项**。当前安装方式使用本地开发人员加载项。 [微软安装说明](https://learn.microsoft.com/en-us/office/dev/add-ins/testing/sideload-an-office-add-in-on-mac) |
| **Node.js 22 或更新版本**          | 在官方下载页选择 **LTS** 和 macOS 的 `.pkg` 安装包。装好后打开一个新的终端窗口，运行 `node -v`。 [下载 Node.js](https://nodejs.org/en/download)                                                 |
| **完整的 MacTeX**                  | 在官网选择 **MacTeX Download**，下载并运行 `.pkg`。已有完整 MacTeX 的用户可跳过安装。 [下载 MacTeX](https://tug.org/mactex/)                                                                      |

已测试的开发环境为 Apple 芯片 Mac、macOS 15.3、Word 16.98、Node.js 24 和 MacTeX 2025。Windows 版、网页版和 iPad 版 Word 暂无安装流程。

### 检查环境

打开 macOS 的「终端」，逐行运行以下命令。第一行应显示 Node.js 版本，接下来三行应各自显示版本信息，最后一行应显示字体文件的路径。

```sh
node -v
/Library/TeX/texbin/latex --version
/Library/TeX/texbin/xelatex --version
/Library/TeX/texbin/dvisvgm --version
/Library/TeX/texbin/kpsewhich texgyretermes-math.otf
```

项目没有 npm 第三方依赖。装好 Word、Node.js 和 MacTeX 后，直接运行启动文件即可。

## 2. 下载并安装到 Word

1. 打开 GitHub 项目主页，选择 **Code → Download ZIP**。解压 ZIP，并在 Finder 中打开包含 `启动 Easy LaTeX.command` 的目录。 [Easy LaTeX 项目主页](https://github.com/yifengchen07/easy-latex-in-mac)
2. 双击 **启动 Easy LaTeX.command**。它会为当前用户注册 Word 加载项并启动本机服务。看到 `Easy LaTeX 已启动` 后，保留这个终端窗口。
3. 如果 Word 已经开着，保存文档后按 **⌘Q** 完全退出，再重新打开 Word。
4. 新建空白文档，选择 **开始 → 加载项 → 开发人员加载项 → Easy LaTeX**。公式编辑器会显示在侧栏。

若 Finder 报告启动文件没有执行权限，可在终端进入解压后的目录，再用 `zsh` 运行。进入目录的一种方式是在终端键入 `cd `（末尾保留一个空格），把目录从 Finder 拖进终端，按回车。

```sh
zsh "./启动 Easy LaTeX.command"
```

## 3. 插入并修改第一个公式

1. 将 Word 光标放在要插入公式的位置，打开 Easy LaTeX。
2. 在 **LaTeX 公式** 输入框粘贴下面一行。

   ```latex
   \frac{x_i+\alpha}{\sqrt{1+y^2}}
   ```
3. 选择字体、数学样式和字号。确认预览后点 **插入公式**，或在公式框按 **⌘ Return**。
4. 保存为 `.docx`。要修改公式时，在 Word 正文里选中它，点 **读取所选公式**，改完后点 **更新所选公式**。

公式框和导言区都有 **复制** 和 **粘贴** 按钮。复制时优先复制选中的文字，未选中文字时会复制整栏。粘贴在光标处插入，或替换选区。

### 字体与排版

- **Computer Modern** 使用经典 LaTeX 数学字形和 AMS 扩展符号。
- **Times New Roman** 使用本机字体排版常规字母、数字和普通文本，根号、伸缩括号及部分数学字形由 TeX Gyre Termes Math 补足。
- **行内**和**行间**决定 LaTeX 数学样式。要让公式独占一行，先在 Word 中另起一段，再插入行间公式。字号为 8–36 pt。
- `align`、`gather`、`equation` 等环境可以直接粘贴。有编号的公式独立排版，可用 `\tag{…}` 指定编号。对 TikZ 和自定义环境，选择 **原样 LaTeX**。在原样模式下，普通公式用 `\[ … \]` 等定界符包起来。

### 宏包与自定义命令

展开 **导言区**，填入要加载的宏包和自定义命令。

```latex
\usepackage{mathtools,cancel}
\DeclarePairedDelimiter{\abs}{\lvert}{\rvert}
```

再在公式框输入 `\abs*{\cancel{x^2}+1}`。宏包从 MacTeX 安装目录读取。可用命令取决于已安装的宏包、所选排版引擎和 SVG 转换能力。每次插入生成一张图，依赖 LuaLaTeX、外部程序或跨页结构的工作流需在完整的 TeX 工程中运行。

## 4. 日常使用、更新和卸载

- **日常使用**。使用前双击启动文件并保留终端窗口。结束后可在终端按 **Control+C** 停止服务。已插入的图片保存在文档中，查看这些图片无需启动服务。
- **更新**。停止旧服务。重新下载并解压新版，再运行新版目录里的启动文件，关闭并重新打开 Word 窗格。
- **卸载**。停止服务并退出 Word。在 Finder 按 **⌘⇧G**，前往 `~/Library/Containers/com.microsoft.Word/Data/Documents/wef/`，将 `EasyLaTeX.xml` 移到废纸篓。重新打开 Word。如果菜单仍显示旧条目，可参考微软的加载项缓存排错说明。 [微软说明](https://learn.microsoft.com/en-us/office/dev/add-ins/testing/sideload-an-office-add-in-on-mac#remove-a-sideloaded-add-in)

## 5. 安装排错

| 现象                                         | 处理方法                                                                                                                                                                                                                                                                                            |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 终端提示安装 Node.js                         | 在新终端运行 `node -v`。确认版本至少为 22。如果终端找得到 Node.js、双击却找不到，在项目目录用上面的 `zsh` 命令启动。                                                                                                                                                                            |
| 找不到 `latex`、`xelatex` 或 `dvisvgm` | 按「检查环境」逐项检查 `/Library/TeX/texbin`，确认激活的是完整的 MacTeX。                                                                                                                                                                                                                         |
| Word 菜单里没有 Easy LaTeX                   | 确认启动文件已运行，以及 `~/Library/Containers/com.microsoft.Word/Data/Documents/wef/EasyLaTeX.xml` 存在。保存文档，用 **⌘Q** 退出 Word 后重开。                                                                                                                                           |
| 窗格白屏、提示「页面不存在」或无法连接       | 停止旧服务，重新运行启动文件并打开窗格。如果仍有问题，可在浏览器打开 [本机预览页](http://127.0.0.1:43127/)。浏览器里可以检查排版，插入功能在 Word 中使用。若网页能打开但 Word 仍连不上，检查当前网络能否访问 [微软的 Office.js 服务](https://officeapis.public.onecdn.static.microsoft/1/office.js)。 |
| 终端提示 `EADDRINUSE`                      | 先检查是否已经有一个 Easy LaTeX 终端窗口在运行。按 **Control+C** 停止旧实例，再启动新版。                                                                                                                                                                                                     |
| LaTeX 提示命令未定义或缺少宏包               | 查看报错的行号。把 `\usepackage{…}` 放进导言区，并确认该宏包已安装在当前 MacTeX 中。                                                                                                                                                                                                             |
| 复制或粘贴快捷键无响应                       | 使用公式框或导言区下方的 **复制**、**粘贴** 按钮。                                                                                                                                                                                                                                      |

如果遇到其他问题，可在 [GitHub Issues](https://github.com/yifengchen07/easy-latex-in-mac/issues) 提供 macOS 版本、Word 版本、终端或侧栏的报错，以及能复现问题的最短公式。

## 本机运行与许可

公式和导言区通过本机服务 `127.0.0.1:43127` 交给 TeX 排版。Word 窗格会加载微软提供的 Office.js，因此打开窗格时需能访问微软的服务。分享 `.docx` 时，公式源码和导言区也会随嵌入公式一起分享。

项目源码公开，可免费用于学习、研究和工作，也可按许可修改和免费分享。自引入组合许可的提交起，项目采用 [MIT + Commons Clause 1.0](LICENSE)。向他人收费提供价值全部或主要来自 Easy LaTeX 功能的产品或服务，需要另行取得授权。 [Commons Clause 原文与 FAQ](https://commonsclause.com/)

开发者可在 macOS 的普通终端运行 `npm test`。
