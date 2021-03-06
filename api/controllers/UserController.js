/**
 * UserController
 *
 * @description :: Server-side logic for managing Users
 * @help        :: See http://sailsjs.org/#!/documentation/concepts/Controllers
 *
 */

//sleep = require('sleep');
var PNG = require("pngjs-image");
var fs = require("fs");
//var counterUserAvatarsFound = 0;
var asyncCounter = 0;
var prunedUsers;
var avatarFilepath = "upload_data/";
var myarray = 0;

var userAvatarTimer = 0;



/**
 * This function FINDS the file based on file id (function parameter) and
 * Reads this file using readFileSync.
 * @param fileid :
 */
function getAvatarFileAsync (fileid,index,res,usercount){

  //var userAvatar = null;
  //var userAvatarFile = null;
  //user.avatar is a JSON object consisting of many file attributes
  var file;
  var filepath = avatarFilepath;

    //find the file (avatar) record
    asyncCounter++;

    File.findOne({id: fileid})
      .exec({

        //if something happened and the file was not found, then file is null
        error: function (err) {

          asyncCounter--;
          console.log("something happened and the file with id= " + fileid + " was not found " + err);
          prunedUsers[index]['file'] = null;


          // if i am the last called then respond to client
          if (asyncCounter === 0) {
            res.json(200,
              {
                listOfUsers: prunedUsers,
                totalNumberOfUsers: usercount
              }
            );
          }
        },

        //file found
        success: function (foundfile) {

          asyncCounter--;
          console.log(index);
          filepath = filepath + foundfile.name;

          //TODO: if file !== null or undefined
          try {
            //this is the synchronous function
            file = fs.readFileSync(filepath);
            prunedUsers[index]['file'] = file;
          }catch(ex){
            console.log("getAvatarFileAsync: Catch an exception during 'readFileSync' : " + ex);
            prunedUsers[index]['file'] = null;
          }finally {
            // if i am the last called then respond to client
            if (asyncCounter === 0) {
              res.json(200,
                {
                  listOfUsers: prunedUsers,
                  totalNumberOfUsers: usercount
                }
              );
            }

          }

        } //success: function (foundfile)
      }); //File.findOne(

};

/* ########################################## A C T I O N S ############################################### */

module.exports = {

  /**
   *
   * @param req
   * @param res
   * @returns {*}
   */
  removeUser: function (req, res) {

    if (!req.param('id')){
      return res.badRequest('id is a required parameter.');
    }

    User.destroy({
      id: req.param('id')
    }).exec(function (err, usersDestroyed){
      if (err)
        return res.negotiate(err);

      if (usersDestroyed.length === 0) {
        return res.notFound();
      }

      return res.ok();
    });
  },


  /**
   * Normally if unspecified, pointing a route at this action will cause Sails
   * to use its built-in blueprint action.  We're overriding that here to strip some
   * properties from the user before sending it down in the response.
   */
  findOne: function (req, res) {

    if (!req.param('id')){
      return res.badRequest('id is a required parameter.');
    }

    User.findOne(req.param('id')).exec(function (err, user) {
      if (err) return res.negotiate(err);
      if (!user) return res.notFound();

      // "Subscribe" the socket.io socket (i.e. browser tab)
      // to each User record to hear about subsequent `publishUpdate`'s
      // and `publishDestroy`'s.
      if (req.isSocket) {
        User.subscribe(req, user.id);
      }

      // Only send down white-listed attributes
      // (e.g. strip out encryptedPassword)
      return res.json({
        id: user.id,
        name: user.name,
        email: user.email,
        title: user.title,
        admin: user.admin,
        lastLoggedIn: user.lastLoggedIn

      }); //</res.json>

    }); //</User.findOne()>
  },


  /**
   * Normally if unspecified, pointing a route at this action will cause Sails
   * to use its built-in blueprint action.  We're overriding that here to strip some
   * properties from the objects in the array of users (e.g. the encryptedPassword)
   */
  find: function (req, res) {

    // "Watch" the User model to hear about `publishCreate`'s.
    User.watch(req);

    User.find().exec(function (err, users) {
      if (err) return res.negotiate(err);

      var prunedUsers = [];

      // Loop through each user...
      _.each(users, function (user){

        // "Subscribe" the socket.io socket (i.e. browser tab)
        // to each User record to hear about subsequent `publishUpdate`'s
        // and `publishDestroy`'s.
        if (req.isSocket){
          User.subscribe(req, user.id);
        }

        // Only send down white-listed attributes
        // (e.g. strip out encryptedPassword from each user)
        prunedUsers.push({
          id: user.id,
          name: user.name,
          email: user.email,
          title: user.title,
          gravatarUrl: user.gravatarUrl,
          admin: user.admin,
          lastLoggedIn: user.lastLoggedIn

        });
      });

      // Finally, send array of users in the response
      return res.json(prunedUsers);
    });
  },


  /**
   * Update any user.
   */
  update: function (req, res) {

    if (!req.param('id')) {
      return res.badRequest('`id` of user to edit is required');
    }

    (function _prepareAttributeValuesToSet(allParams, cb){

      var setAttrVals = {};
      if (allParams.name) {
        setAttrVals.name = allParams.name;
      }
      if (allParams.title) {
        setAttrVals.title = allParams.title;
      }
      if (allParams.email) {
        setAttrVals.email = allParams.email;
        // If email address changed, also update gravatar url
        // execSync() is only available for synchronous machines.
        // It will return the value sent out of the machine's defaultExit and throw otherwise.
        setAttrVals.gravatarUrl = require('machinepack-gravatar').getImageUrl({
          emailAddress: allParams.email
        }).execSync();
      }

      // In this case, we use _.isUndefined (which is pretty much just `typeof X==='undefined'`)
      // because the parameter could be sent as `false`, which we **do** care about.
      if ( !_.isUndefined(allParams.admin) ) {
        setAttrVals.admin = allParams.admin;
      }

      // Encrypt password if necessary
      if (!allParams.password) {
        return cb(null, setAttrVals);
      }
      require('machinepack-passwords').encryptPassword({password: allParams.password}).exec({
        error: function (err){
          return cb(err);
        },
        success: function (encryptedPassword) {
          setAttrVals.encryptedPassword = encryptedPassword;
          return cb(null, setAttrVals);
        }
      });
    })(req.allParams(), function afterwards (err, attributeValsToSet){
      if (err) return res.negotiate(err);

      User.update(req.param('id'), attributeValsToSet).exec(function (err){
        if (err) return res.negotiate(err);

        // Let all connected sockets who were allowed to subscribe to this user
        // record know that there has been a change.
        User.publishUpdate(req.param('id'), {
          name: attributeValsToSet.name,
          email: attributeValsToSet.email,
          title: attributeValsToSet.title,
          admin: attributeValsToSet.admin,
          gravatarUrl: attributeValsToSet.gravatarUrl
        });

        return res.ok();
      });
    });

  },

    /**OK
     * Validate user using an email
     * isTokenAuthorized policy called before this action starts.
     * isUserTokenValid called before this action begins (search for user and compares tokens)
     * @param req {String} User email and token
     * @param res
     */
    loginExistedUser: function (req, res) {

        console.log('loginExistedUser API');

        //Check if req params are correctly defined
        req.validate({
          email: 'string',
          token: 'string'
        });

        //Look up for the user using the provided email address
        User.findOne({
          email: req.param('email')
        },function foundUser(err, user) {

            if (err) {
                console.log("loginExistedUser: negotiate error");
                return res.negotiate(err);
            }

            if (!user){
                console.log("loginExistedUser: No user found");
                return res.notFound();
            }
            else { //if user exists
                return res.json(200, {user: user});

            }
        }); //User.findOne

  },


    test: function (req, res) {

        if (req.headers) {
            console.log(req.headers);
        }

        return res.ok();

    },


  /**OK
   * Check the provided email address and password, and if they
   * match a real user in the database, sign in to Activity Overlord.
   */
  login: function (req, res) {

    req.validate({
      email: 'string',
      password: 'string'
    });

    // Try to look up user using the provided email address
    User.findOne({
      email: req.param('email')
    }, function foundUser(err, user) {
      if (err) {console.log("negotiate error");return res.negotiate(err)};
      if (!user) {console.log("not user");return res.notFound();}


      require('machinepack-passwords').checkPassword({passwordAttempt: req.param('password') , encryptedPassword: user.encryptedPassword})
          .exec({

            error: function (err){
              return res.negotiate(err);
            },

            /**
             * INCORRECT password:
             * If the password from the form parameters doesn't match
             * the encrypted password from the database returns notFound response (404)
             *
             * @returns {*}
             */
            incorrect: function (){
              return res.notFound();
            },

            /**
             * SUCCESS password:
             *
             */
            success: function (){
              // The user is "logging in" (e.g. establishing a session)
              //console.log(JSON.stringify(user));

              // 1. so update the `lastLoggedIn` attribute.
              User.update(user.id, {lastLoggedIn: (new Date()).toString()},
                  function(err) {
                    if (err) return res.negotiate(err);

                  });

              // 2. issue a user token - another way
              // Keep in mind that function(err,updated) is used this way
              User.update(user.id, {token: jwtToken.issueToken({userid: user.id})},
                  function(err,updated) {
                    if (err) return res.negotiate(err);

                    // res.json([statusCode, ... ] data);
                    res.json(200, {user: updated[0]});
                  });
            }
          });
    });


  },


  /**OK
   * Log out
   * (wipes `me` from the session)
   */
  logout: function (req, res) {

    console.log("Logout API");

    var header_token = null;

    if (req.headers) {

        if (header_token === undefined) {
            return res.json(401, {err: 'No Authorization header was found'});
        }
        else {

            User.findOne({
               id: req.param('id')
            }, function foundUser(err, user) {

              if (err) {
                console.log("Logout: Error find user!");
                return res.negotiate(err);
              }

              if (user) {

                User.update(user.id, {token: ""},function (err, updated) {
                      if (err) return res.negotiate(err);

                      if (updated) {
                        res.json(200);
                      }
                });

              }
              else { //user not found
                console.log("Logout: User not found!");
                return res.notFound();
              }

            }); //User.findOne
          }
      }
  },

  /**
   * Returns a list of users
   * @param req
   * @param res
   * limit() function in MongoDB is used to specify the maximum number of results to be returned.
   */
  userList: function (req, res) {

    /*
      if(myarray == 0){
        myarray++;
        sleep.sleep(10);
      }
      console.log(myarray);
*/

    /*
      fs.readFile("", function (err, data) {

        sleep.sleep(10);

        console.log(myarray);

        myarray--;

        console.log(myarray);
      });*/

    //Example 3: not working
    /*var  myarray = new Array(10);
    var count = 0;
    _.each(myarray, function () {
      count++;
      console.log('each = ' + count);
      (function example3() {
        fs.readFile("", function (err, data) {
          console.log('readfile = ' + count);
          //sleep.sleep(10);
        })
      })(count);
    });*/

    //example 2
    /*
    var myarray = new Array(10);

    var num=0;
    _.forEach(myarray,function(number){

      num++;
      console.log("foreach: " + num);


      fs.readFile("", function (err, data) {
        if (err) {console.log("readfile: " + num);}
      });

    });
    */


    //Example 3
    /*
    var myarray = new Array(10);

    var num=0;
    _.forEach(myarray,function(number){

      num++;
      console.log("foreach: " + num);

      (function ioio (){

        //this.num = num;
        var numo = num;
        console.log("ioio: " + num);

        fs.readFile("", function (err, data) {
          if (err) {
            console.log("readfile: " + numo);
          }
        });

      })(num);

    });
    */

    //Example 4: sleep
    /*var myarray = new Array(10);

    var num=0;
    _.forEach(myarray,function(number){

      num++;
      console.log("foreach: " + num);

      (function ioio (){

        //this.num = num;
        var numo = num;
        console.log("ioio: " + num);

        sleep.sleep(10);

      })(num);

    });*/


    //Example 5: increase file size
    /*
    var myarray = new Array(1);

    var num=0;
    _.forEach(myarray,function(number) {

      num++;
      console.log("foreach: " + num);

      (function ioio() {

        //this.num = num;
        var numo = num;
        fs.readFile("./test.pdf", function (err, data) {
          if (data) {
            res.json(data);
            console.log("readfile A: " + numo);
          }
          if (err) {
            res.negotiate(err);
          }
        });

      })(num);
    });
    */
    var filename = './test.pdf';
    var stat = fs.statSync(filename);

    res.writeHead(200, {
      'Content-Type': 'application/exe',
      'Content-Length': stat.size
    });

    require('fs').createReadStream(filename)
      .on('error', function (err) {
        return res.serverError(err);
      })
      .pipe(res);

    console.log("code completed here ");
  },

  userListold: function (req, res) {

    var usercount = 0;
    var textForSearch = req.param('searchText');
    var pagesize = req.param("pageSize");
    var skipcount = req.param("paginationGetListStartIndex")-1;

    asyncCounter = 0;

    if(textForSearch === undefined)
      textForSearch = "";


    var likeObj =
    {
      name:'%'+textForSearch+'%'
    };

    var likeObject = {
      like:{
        name:'%'+textForSearch+'%'
      }
    };

    var likewithpaginationObject = {
      like:{
        name:'%'+textForSearch+'%'
      },
      skip:skipcount,
      limit:pagesize
    };


    //Get the total number of User model collection
    User.count(likeObject).exec({
      error:function(err){
        console.log(err);
        return res.negotiate(err);
      },
      success: function (numberofusersfound) {

        if(numberofusersfound == 0){

          // respond back with an empty list
          return res.json(200,
            {
              listOfUsers: [],
              totalNumberOfUsers: 0
            });

        }
        else{
          usercount = numberofusersfound;
        }

        User.find(likewithpaginationObject).populate('avatar')
          .exec({

          error: function (err) {
            console.log("Server error when populate users' avatar images : " + err);
            return res.negotiate(err);
          },

          success: function (users) {

            prunedUsers = []; //global variable
            var usersWithAvatars = 0;

            // Loop through each user... (0, 1, 2, ... )
            // Create user list with information
            _.each(users, function (user,index) {
                  prunedUsers.push({
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    title: user.title,
                    file: null, //just for now
                    lastLoggedIn: user.lastLoggedIn
                  });

                  if (user.avatar !== undefined){
                    usersWithAvatars++;
                  }

              });

            if(usersWithAvatars === 0 ){
              // respond back with empty list
              return res.json(200,
                {
                  listOfUsers: prunedUsers,
                  totalNumberOfUsers: usercount
                });
            }
            else { //if at least a user has an avatar image

              _.each(users, function (user, index) {
                if (user.avatar !== undefined)
                  getAvatarFileAsync(user.avatar['id'], index, res, usercount); //find file and increase counter when file retrieved
              });

            }

          } //in success

        });

      }


    });
  },


  /**
   * Update a user account.
   * Update only user's name and user's email
   * updateuser action's policies: isTokenAuthorized, isAdmin
   *
   */
  updateUser: function(req, res) {

    if (!req.param('id')) {
      return res.badRequest('`id` of user to edit is required');
    }

    (function _prepareAttributeValuesToSet(allParams, cb){

      var setAttrVals = {};
      if (allParams.name) {
        setAttrVals.name = allParams.name;
      }
      if (allParams.title) {
        setAttrVals.title = allParams.title;
      }
      if (allParams.email) {
        setAttrVals.email = allParams.email;
        // If email address changed, also update gravatar url
        // execSync() is only available for synchronous machines.
        // It will return the value sent out of the machine's defaultExit and throw otherwise.
        setAttrVals.gravatarUrl = require('machinepack-gravatar').getImageUrl({
          emailAddress: allParams.email
        }).execSync();
      }

      // In this case, we use _.isUndefined (which is pretty much just `typeof X==='undefined'`)
      // because the parameter could be sent as `false`, which we **do** care about.
      if ( !_.isUndefined(allParams.admin) ) {
        setAttrVals.admin = allParams.admin;
      }

      // Encrypt password if necessary
      if (!allParams.password) {
        return cb(null, setAttrVals);
      }
      require('machinepack-passwords').encryptPassword({password: allParams.password}).exec({
        error: function (err){
          return cb(err);
        },
        success: function (encryptedPassword) {
          setAttrVals.encryptedPassword = encryptedPassword;
          return cb(null, setAttrVals);
        }
      });
    })(req.allParams(), function afterwards (err, attributeValsToSet){
      if (err) return res.negotiate(err);

      User.update(req.param('id'), attributeValsToSet).exec(function (err){
        if (err) return res.negotiate(err);

        return res.ok();
      });
    });

  },


  /**
   * Create a new user account.
   * adduser action's policies: isTokenAuthorized, isAdmin
   *
   */
  adduser: function(req, res) {


    //1. can user do this action? - isUserAuthorized
    //2. is user logged in - isTokenAuthorized
    //isAdmin.verifyToken(header_token,function(err, token) {}

    /* User requested the creation of a new user has an ADMIN role? */
    //isAdmin


    /* Create the user */
    req.validate({
      email: 'string',
      password: 'string'
    });

    // Encrypt user's new password
    require('machinepack-passwords').encryptPassword({password: req.param('password')})
      .exec({

        error: function(err) {
          return res.negotiate(err);
        },

        success: function(encryptedPassword) {

          require('machinepack-gravatar').getImageUrl({emailAddress: req.param('email')})
            .exec({

              error: function(err) {
                return res.negotiate(err);
              },

              success: function(gravatarUrl) {

                // Create a User with the params sent from
                // the addUserForm
                User.create({
                  name: req.param('name'),
                  surname: req.param('surname'),
                  title: req.param('title'),
                  email: req.param('email'),
                  encryptedPassword: encryptedPassword,
                  lastLoggedIn: new Date(),
                  gravatarUrl: gravatarUrl
                }, function userCreated(err, newUser){

                  if (err) {
                    // If this is a uniqueness error about the email attribute,
                    // send back an easily parseable status code.
                    if (err.invalidAttributes && err.invalidAttributes.email && err.invalidAttributes.email[0] && err.invalidAttributes.email[0].rule === 'unique') {
                      //TODO: use res.emailAddressInUse()
                      return res.emailAddressInUse();
                    }

                    // Otherwise, send back something reasonable as our error response.
                    return res.negotiate(err);
                  }

                  // Send back the id of the new user
                  return res.json(200,{
                    id: newUser.id
                  });
                });
              }

            });
        }
      });
  }


};

