console.log('Setting up webserver')

const Spark = Packages.spark.Spark
const get = Packages.spark.Spark.get

Spark.port(4567)

get('/hello', (req, res) => '{\"status\": \"Up\"}')
