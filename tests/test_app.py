import io
import json
import tempfile
import unittest
from pathlib import Path

from docx import Document
from fastapi.testclient import TestClient

import server


class StandaloneAppTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.previous_paths = (server.DB_PATH, server.PDF_DIR, server.TMP_DIR, server.PID_PATH)
        root = Path(self.temp.name)
        server.DB_PATH = root / 'resume.db'
        server.PDF_DIR = root / 'pdfs'
        server.TMP_DIR = root / 'tmp'
        server.PID_PATH = root / 'server.pid'
        server.PDF_DIR.mkdir()
        server.TMP_DIR.mkdir()
        self.client_context = TestClient(server.app)
        self.client = self.client_context.__enter__()

    def tearDown(self):
        self.client_context.__exit__(None, None, None)
        server.DB_PATH, server.PDF_DIR, server.TMP_DIR, server.PID_PATH = self.previous_paths
        self.temp.cleanup()

    def test_sample_import_save_reload_and_json_backup(self):
        sample = (server.ROOT / 'examples' / '演示简历.json').read_bytes()
        first = self.client.post('/api/import', files={'file': ('demo.json', sample)}).json()['data']
        second = self.client.post('/api/import', files={'file': ('demo.json', sample)}).json()['data']
        self.assertNotEqual(first['id'], second['id'])
        first['basic']['customFields'].append({'label': '', 'value': ''})
        saved = self.client.post('/api/resumes', json={'data': first})
        self.assertEqual(saved.status_code, 200)
        restored = self.client.get('/api/resumes/' + first['id']).json()['data']
        self.assertEqual(restored['basic']['customFields'][-1], {'label': '', 'value': ''})
        backup = self.client.get('/api/resumes/' + first['id'] + '/json')
        self.assertEqual(backup.status_code, 200)
        self.assertEqual(backup.json()['basic'], first['basic'])
        self.assertIn('attachment;', backup.headers['content-disposition'])
        duplicate = self.client.post('/api/resumes/' + first['id'] + '/duplicate').json()['data']
        self.assertNotEqual(duplicate['id'], first['id'])
        self.assertEqual(len(self.client.get('/api/resumes').json()), 2)
        self.assertEqual(self.client.delete('/api/resumes/' + duplicate['id']).status_code, 200)

    def test_word_and_markdown_import_without_model(self):
        document = Document()
        document.add_paragraph('演示同学')
        document.add_paragraph('教育背景')
        document.add_paragraph('示例大学 信息管理 本科')
        content = io.BytesIO()
        document.save(content)
        for filename, data in [('demo.docx', content.getvalue()), ('demo.md', '# 项目经历\n- 完成用户访谈与交互原型。'.encode())]:
            response = self.client.post('/api/import', files={'file': (filename, data)})
            self.assertEqual(response.status_code, 200)
            self.assertTrue(response.json()['data']['sections'])
            self.assertIn('检查', response.json()['notice'])

    def test_invalid_json_and_scan_pdf_message(self):
        for raw in [b'[]', b'{broken', json.dumps({'hello': 'world'}).encode()]:
            response = self.client.post('/api/import', files={'file': ('demo.json', raw)})
            self.assertEqual(response.status_code, 400)
        self.assertEqual(self.client.get('/api/knowledge').status_code, 404)
        self.assertEqual(self.client.post('/api/customize').status_code, 404)

    def test_no_personal_default_photo_or_ai_calls(self):
        html = self.client.get('/').text
        javascript = self.client.get('/app.js').text
        self.assertNotIn('knowledge-btn', html)
        self.assertNotIn('optimize-view', html)
        self.assertNotIn('/api/default-photo', javascript)
        self.assertNotIn('health.ai', javascript)
        self.assertEqual(self.client.get('/api/default-photo').status_code, 404)
        self.assertEqual(self.client.get('/api/health').json()['app'], 'resume-layout-studio')


if __name__ == '__main__':
    unittest.main()
