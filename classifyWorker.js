const tf = require('@tensorflow/tfjs-node')
const mobilenet = require('@tensorflow-models/mobilenet')

const { connectToDb } = require('./lib/mongo')
const { connectToRabbitMQ, getChannel } = require('./lib/rabbitmq')
const { getDownloadStreamById, updatePhotoTagsById, getPhotoInfoByTag, createThumb, updatePhotoByThumbId} = require('./models/photo')


const queue = 'photos'

connectToDb(async function(){
    await connectToRabbitMQ(queue)
    const channel = getChannel()
    const classifier = await mobilenet.load()

    channel.consume(queue, async function(msg){
        if(msg){
            const id = msg.content.toString()
            const downloadStream = getDownloadStreamById(id)
    
            const photoData = []
            downloadStream.on('data', function(data){
                photoData.push(data)
            })
            downloadStream.on('end', async function(){
                const img = tf.node.decodeImage(Buffer.concat(photoData))
                const classifications = await classifier.classify(img)
                console.log(classifications)
                const tags = classifications
                    .filter(classif => classif.probability > 0.5)
                    .map(classif => classif.className)
                console.log(tags)
                await updatePhotoTagsById(id, tags)
                const photo = await getPhotoInfoByTag(tags)
                const thumb_id = await createThumb(Buffer.concat(photoData),photo)
                console.log("This is id of thumb: ", thumb_id)
                await updatePhotoByThumbId(thumb_id)
                /*const resBody = {
                    _id: photo._id,
                    url: `/media/photos/${photo.filename}`,
                    mimetype: photo.metadata.mimetype,
                    businessId: photo.metadata.businessId,
                    caption: photo.metadata.caption,
                    tags: photo.metadata.tags
                  }
                console.log("Here is photo info from tag: ", resBody)*/
                
            })
        }
        channel.ack(msg)
    })
})