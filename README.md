# 简历排版工作台

一个在自己电脑上运行的轻量简历排版工具。导入内容、调整模板、查看 A4 分页，最后导出 PDF。无需模型 API，简历与照片只保存在本地。

## 安装与启动

适用于 **Windows 10/11 64 位**，电脑需安装 Edge 或 Chrome。

下载 [一键安装.cmd](https://github.com/ljm434782/resume-layout-studio/raw/refs/heads/main/一键安装.cmd)，双击即可自动下载项目、检测或安装 Python、安装依赖并打开页面，首次安装需要联网。

默认安装到 `%LOCALAPPDATA%\ResumeLayoutStudio`。以后使用桌面上的 **Resume Layout Studio** 快捷方式即可。

也可以点击 **Code → Download ZIP**，解压后双击 **安装.cmd**；以后双击 **开始.cmd**。

默认地址：<http://127.0.0.1:4180/>。安装完成后，日常编辑和导出无需联网。

## 使用

- **新建**：填写基本信息，新增、重命名或调整简历模块。
- **导入**：JSON 完整还原结构；Word（.docx）、文字版 PDF、Markdown、TXT 提取文字后需检查整理。不支持扫描 PDF 和旧版 .doc。
- **模板**：切换两套模板，调整字体、颜色、间距、要点缩进和照片。
- **导出 PDF**：按照右侧分页预览生成 PDF，并保存到简历库。
- **导出 JSON**：备份当前内容，之后可以重新导入继续编辑。
- **简历库**：打开、复制、重命名和删除简历，下载已生成的 PDF。

首次打开可点击 **打开演示简历**。示例中的人物、单位和经历均为虚构。

## 常见问题

- **安装失败**：检查网络连接，再次运行安装脚本；重复安装不会清空简历。
- **页面打不开**：双击 **查询状态.cmd**，或查看 `logs/server.err.log`。
- **PDF 导出失败**：安装或更新 Edge / Chrome 后重试。
- **关闭工具**：双击 **结束.cmd**。关闭浏览器标签页不会停止本地服务。

数据保存在 `data/`，备份时复制整个文件夹。请勿删除它，也不要公开分享包含真实简历的 `data/`。

<details>
<summary>开发运行</summary>

需要 Python 3.10–3.14：

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe server.py
```

运行测试：`python -m unittest discover -s tests -v`（先安装 `requirements-dev.txt`）。

</details>
