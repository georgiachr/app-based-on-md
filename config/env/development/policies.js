/**
 * Policy Mappings
 * (sails.config.policies)
 *
 * Policies are simple functions which run **before** your controllers.
 * You can apply one or more policies to a given controller, or protect
 * its actions individually.
 *
 * Any policy file (e.g. `api/policies/authenticated.js`) can be accessed
 * below by its filename, minus the extension, (e.g. "authenticated")
 *
 * For more information on configuring policies, check out:
 * http://sailsjs.org/#!documentation/
 */


module.exports.policies = {

  // Default policy for all controllers and actions
  // (`true` allows public access)
  //'*': true
    // isTokenAuthorized for everytng else

  //'*': ['isTokenAuthorized'], // Everything resctricted here
  //
  'UserController': {
      'login': true, // We do not need authorization here, allowing public access
      'logout': ['isTokenAuthorized','isUserTokenValid'],
      'loginExistedUser': ['isTokenAuthorized','isUserTokenValid'],
      'test': true
      //'validateUser': ['isTokenAuthorized']
      //  'addUser': ['isAdmin'],
      //  'userList': ['isAdmin'],
      //  'updateUser': ['isAdmin'],
      //  'destroy': ['isAdmin']
  }
  //
  //'FileController': {
  //  'uploadAvatar': ['isAdmin']
  //}

};
