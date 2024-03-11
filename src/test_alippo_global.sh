export TIME_TO_EXIT=2000
export VS_INVALIDATE_CACHE_URL=http://localhost:3000/invalidate?key=aeSu7aip&tag=
export VS_INVALIDATE_CACHE=1

echo 'Italian store - it'
export INDEX_NAME=alippo_search

node --harmony cli_alippo.js global --removeNonExistent=true 