"""把 assets/library/ 下的 PDF 打包成同名的 .pdf.js，供文库页的站内阅读器读取。

为什么不让阅读器直接请求 .pdf：
  IDM 等下载工具会拦截浏览器收到的 PDF 响应并弹出下载框，访客一打开文库页就会被弹下载。
  打包成 JS 后经 <script> 加载，下载工具不会拦截；双击 file:// 打开时 <script> 也照常可用。
  原始 .pdf 仍然保留，只在访客点「下载」时才会被请求。

用法（在仓库根目录）：
  python tools/pack-pdf.py

每次新增或替换 assets/library/ 里的 PDF 后运行一次：全部重新生成，
并清掉对应 PDF 已被删除的旧 .pdf.js。只用标准库，无需安装任何依赖。
"""
import base64
import json
import pathlib

LIB = pathlib.Path(__file__).resolve().parent.parent / 'assets' / 'library'


def main():
    pdfs = sorted(LIB.glob('*.pdf'))
    for pdf in pdfs:
        data = pdf.read_bytes()
        if not data.startswith(b'%PDF'):
            print(f'跳过 {pdf.name}：不是 PDF 文件')
            continue
        out = pdf.with_name(pdf.name + '.js')
        b64 = base64.b64encode(data).decode('ascii')
        out.write_text(
            f'/* 由 tools/pack-pdf.py 从 {pdf.name} 生成，请勿手改；PDF 更新后重新运行该脚本 */\n'
            f'(window.YUNSEE_PDF = window.YUNSEE_PDF || {{}})[{json.dumps(pdf.name)}] =\n'
            f"'{b64}';\n",
            encoding='utf-8', newline='\n')
        print(f'{pdf.name}  {len(data) / 1024:.0f} KB  ->  {out.name}')

    for js in sorted(LIB.glob('*.pdf.js')):
        if not js.with_suffix('').exists():
            js.unlink()
            print(f'已删除孤立的 {js.name}')

    if not pdfs:
        print('assets/library/ 下没有 PDF')


if __name__ == '__main__':
    main()
