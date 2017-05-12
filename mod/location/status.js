/**
 * @author Pedro Sanders
 * @since v1
 */
var Status = {
  OK: 200,
  NOT_FOUND: 404,
  INTERNAL_SERVER_ERROR: 500,
  message: {
    200: {value: 'Successful request'},
    404: {value:'Unable to find resource/s'},
    500: {value:'Ups something when wrong with the server :('},
  }
};