/**
 * @author Pedro Sanders
 * @since v1
 */
const Status = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  NOT_FOUND: 404,
  NOT_SUPPORTED: 405,
  UNPROCESSABLE_ENTITY: 422,
  CONFLICT: 409,
  INTERNAL_SERVER_ERROR: 500,
  message: {
    200: {
      value: 'Successful request'
    },
    201: {
      value: 'Created'
    },
    400: {
      value: 'Bad request'
    },
    401: {
      value: 'Unauthorized'
    },
    404: {
      value: 'Not found'
    },
    405: {
      value: 'Operation not supported by data source provider'
    },
    422: {
      value: 'Unprocesssable entity'
    },
    409: {
      value: 'Conflict'
    },
    4091: {
      value: 'Found one or more unfulfilled dependencies'
    },
    4092: {
      value: 'Found one or more dependent objects'
    },
    4093: {
      value: 'Entity already exist'
    },
    500: {
      value: 'The execution of the service failed'
    }
  }
}

module.exports.UNFULFILLED_DEPENDENCY_RESPONSE = {
  status: Status.CONFLICT,
  message: Status.message[4091].value
}

module.exports.FOUND_DEPENDENT_OBJECTS_RESPONSE = {
  status: Status.CONFLICT,
  message: Status.message[4092].value
}

module.exports.ENTITY_ALREADY_EXIST_RESPONSE = {
  status: Status.CONFLICT,
  message: Status.message[4093].value
}

module.exports.Status = Status
