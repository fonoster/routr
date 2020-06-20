const System = Java.type('java.lang.System')

module.exports.getConfig = () => {
  const config = {
    system: {
      env: [
        { var: 'ROUTR_JAVA_OPTS', value: System.getenv('ROUTR_JAVA_OPTS') },
        { var: 'ROUTR_DS_PROVIDER', value: System.getenv('ROUTR_DS_PROVIDER') },
        {
          var: 'ROUTR_DS_PARAMETERS',
          value: System.getenv('ROUTR_DS_PARAMETERS')
        },
        {
          var: 'ROUTR_CONFIG_FILE',
          value: System.getenv('ROUTR_CONFIG_FILE')
        },
        {
          var: 'ROUTR_SALT',
          value: System.getenv('ROUTR_SALT')
        },
        {
          var: 'ROUTR_EXTERN_ADDR',
          value: System.getenv('ROUTR_EXTERN_ADDR')
        },
        {
          var: 'ROUTR_LOCALNETS',
          value: System.getenv('ROUTR_LOCALNETS')
        },
        {
          var: 'ROUTR_REGISTRAR_INTF',
          value: System.getenv('ROUTR_REGISTRAR_INTF')
        },
        {
          var: 'ROUTR_BIND_ADDR',
          value: System.getenv('ROUTR_BIND_ADDR')
        }
      ]
    },
    spec: {
      dataSource: {}
    }
  }

  if (System.getenv('ROUTR_DS_PROVIDER'))
    config.spec.dataSource.provider = System.getenv('ROUTR_DS_PROVIDER')
  if (System.getenv('ROUTR_REGISTRAR_INTF'))
    config.spec.registrarIntf = System.getenv('ROUTR_REGISTRAR_INTF')
  if (System.getenv('ROUTR_LOCALNETS'))
    config.spec.localnets = System.getenv('ROUTR_LOCALNETS').split(',')
  if (System.getenv('ROUTR_EXTERN_ADDR'))
    config.spec.externAddr = System.getenv('ROUTR_EXTERN_ADDR')
  if (System.getenv('ROUTR_BIND_ADDR'))
    config.spec.bindAddr = System.getenv('ROUTR_BIND_ADDR')

  return config
}
