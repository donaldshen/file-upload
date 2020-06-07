const http = require('http')
const path = require('path')
const fse = require('fs-extra')
const Busboy = require('busboy')

const server = http.createServer()
const UPLOAD_DIR = path.resolve(__dirname, 'files')

server.on('request', async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', '*')
  if (req.method === 'OPTIONS') {
    res.status = 200
    res.end()
  } else if (req.url === '/verify') {
    controller.handleVerifyUpload(req, res)
  } else if (req.url === '/') {
    controller.handleUpload(req, res)
  } else {
    res.status = 200
    res.end()
  }
})

server.listen(3333, () => console.log('start listening to 3333'))

const controller = {
  async handleVerifyUpload(req, res) {
    // 文件在服务器是以 hash 存储的，感觉直接传 hash + ext 也可以
    const { fileName, hash } = JSON.parse(await readFromStream(req))
    const ext = path.extname(fileName)
    const newFileName = hash + ext
    const filePath = path.resolve(UPLOAD_DIR, newFileName)
    if (fse.existsSync(filePath)) {
      res.end(JSON.stringify({ uploaded: true }))
    } else {
      const uploadedChunks = await getUploadedChunks(hash)
      res.end(JSON.stringify({ uploaded: false, uploadedChunks }))
    }
  },
  async handleUpload(req, res) {
    const busboy = new Busboy({ headers: req.headers })
    const data = {}
    busboy.on('file', async (fieldname, file) => {
      // 这里不 read 就不会 finish
      data[fieldname] = readFromStream(file)
      // console.log('file', fieldname, typeof data[fieldname])
    })
    busboy.on('field', (fieldname, val) => {
      console.log('field', fieldname, val)
      data[fieldname] = val
    })
    busboy.on('finish', async () => {
      const { hash, chunk, index, fileName } = data
      console.log('finish', typeof chunk)
      const ext = path.extname(fileName)
      // 源文件已存在，chunk 不必保存
      const filePath = path.resolve(UPLOAD_DIR, hash + ext)
      if (fse.existsSync(filePath)) {
        res.end('file exist')
      } else {
        const chunkDir = path.resolve(UPLOAD_DIR, hash)
        const chunkName = getChunkName(hash, index)
        const data = await chunk
        console.log('data', data.length)
        await fse.outputFile(path.resolve(chunkDir, chunkName), data)
        res.end('chunk received')
      }
    })
    req.pipe(busboy)
  },
}

function readFromStream(stream) {
  return new Promise((resolve) => {
    let result = ''
    stream.on('data', (d) => (result += d))
    stream.on('end', () => resolve(result))
  })
}

async function getUploadedChunks(hash) {
  const chunksPath = path.resolve(UPLOAD_DIR, hash)
  if (fse.existsSync(chunksPath)) {
    return (await fse.readdir(chunksPath)).map(getIndex)
  } else {
    return []
  }
}

function getChunkName(hash, i) {
  return hash + '-' + i
}

function getIndex(chunkName) {
  return +chunkName.split('-')[1]
}
