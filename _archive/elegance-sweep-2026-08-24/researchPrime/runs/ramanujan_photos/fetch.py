import urllib.request
import json

url = "https://commons.wikimedia.org/w/api.php?action=query&titles=File:Srinivasa_Ramanujan.jpg|File:Srinivasa_Ramanujan_-_OPC_-_1.jpg|File:Srinivasa_Ramanujan-Add._MS_a94_version2.jpg&prop=imageinfo&iiprop=url&format=json"

req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
with urllib.request.urlopen(req) as response:
    data = json.loads(response.read().decode())

urls = []
for page_id, page_info in data['query']['pages'].items():
    urls.append(page_info['imageinfo'][0]['url'])

print(json.dumps(urls, indent=2))
