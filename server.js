const express = require('express')
const morgan = require('morgan')

const api = require('./api')
const { connectToDb } = require('./lib/mongo')
const {getImageDownloadStream, getDownloadStreamById, getThumbDownloadStreamById} = require('./models/photo')
const app = express()
const port = process.env.PORT || 8000

const {connectToRabbitMQ, getChannel} = require('./lib/rabbitmq')
const queue = 'photos'

//const upload = multer({dest: `${__dirname}/uploads`})

/*
 * Morgan is a popular logger.
 */
app.use(morgan('dev'))

app.use(express.json())
app.use(express.static('public'))

/*
 * All routes for the API are written in modules in the api/ directory.  The
 * top-level router lives in api/index.js.  That's what we include here, and
 * it provides all of the routes.
 */
app.use('/', api)

app.get('/media/photos/:id', function(req,res,next){
  getDownloadStreamById(req.params.id)
    .on('file', function(file){
      res.status(200).type(file.metadata.mimetype)
    })
    .on('error', function(err){
      if(err.code === 'ENOENT'){
        next()
      }else{
        next(err)
      }
    })
    .pipe(res)
})

app.get('/media/thumbs/:id', function(req,res,next){
  getThumbDownloadStreamById(req.params.id)
    .on('file', function(file){
      res.status(200).type(file.metadata.mimetype)
    })
    .on('error', function(err){
      if(err.code === 'ENOENT'){
        next()
      }else{
        next(err)
      }
    })
    .pipe(res)
})
//app.use('/media/photos/', express.static(`${__dirname}/api/uploads`))

app.use('*', function (req, res, next) {
  res.status(404).json({
    error: "Requested resource " + req.originalUrl + " does not exist"
  })
})


connectToDb(async () => {
  await connectToRabbitMQ(queue)
  app.listen(port, function () {
    console.log("== Server is running on port", port)
  })
})
