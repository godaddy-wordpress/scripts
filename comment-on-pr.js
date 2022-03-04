const { Octokit } = require( '@octokit/core' );
const axios = require( 'axios' );
const _ = require( 'lodash' );

// Colors
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const RESET = '\x1b[0m';

// Github Auth Token
const AUTH_TOKEN = process.env.GH_AUTH_TOKEN;

// eg: https://github.com/godaddy-wordpress/go/pull/756
const PR_ID = getPullRequestID();

let finalArtifactPath, buildJobArtifactURL;

/**
 * Check the required constants before continuing.
 */
function checkConstants() {

  // No auth token.
  if ( null == AUTH_TOKEN ) {
    console.log( `${RED}Error:${RESET} No Github authentication token provided (GH_AUTH_TOKEN environment variable)` );
    process.exit( 1 );
  }

  // If this is not a pull request, no need to execute the script
  if ( null == PR_ID ) {
    console.log( 'This does not appear to be a pull request.' );
    process.exit( 0 );
  }

}

/**
 * Authorize the user with Github.
 */
async function authorizeUser() {
  const response = await octokit.request( "GET /user" );

  if ( null == response ) {
    console.log( `${RED}Error:${RESET} Unable to verify Github user.` );
    process.exit( 1 );
  }

  const userName = response.data.login;

  console.log( `${GREEN}Success:${RESET} Successfully authenticated as ${userName}` );
}

/**
 * Return the pull request ID from the Circle CI URL.
 *
 * @return {string} The pull request ID.
 */
function getPullRequestID() {
  let url = process.env.CIRCLE_PULL_REQUEST
  let pullRequestID = url.substring( url.lastIndexOf( '/' ) + 1 );
  if ( null == pullRequestID ) {
    return null;
  }
  console.log( `${GREEN}Success:${RESET} Pull Request ID: ${pullRequestID}` );
  return pullRequestID;
}

/**
 * Post a comment on an existing PR with a .zip attachment.
 */
async function commentOnPR() {
  // Create a new comment with a link to the attachment
  let comment = await octokit.request( `POST /repos/${process.env.CIRCLE_PROJECT_USERNAME}/${process.env.CIRCLE_PROJECT_REPONAME}/issues/${PR_ID}/comments`, {
    body: `Download go.zip: ${buildJobArtifactURL}`
  } );
  console.log( `${GREEN}Success:${RESET} Comment created.` );
  console.log( `View Comment: ${comment.data.html_url}` );
}

/**
 * Get the build job artifact URL
 */
async function getBuildJobArtifactURL() {
  return new Promise((resolve) => {
    let url = `https://circleci.com/api/v1.1/project/gh/${process.env.CIRCLE_PROJECT_USERNAME}/${process.env.CIRCLE_PROJECT_REPONAME}`;
    axios.get( url )
      .then( function( response ) {
        // handle success
        let filteredResponse = _.filter( response.data, { workflows: { job_name: "build" } } ); // filter by workflow job name
        filteredResponse = _.filter( filteredResponse, { branch: process.env.CIRCLE_BRANCH } ); // ensure we only get results for this branch
        if ( null == filteredResponse || Object.keys( filteredResponse ).length < 1 ) {
          console.log( `${RED}Error:${RESET} Could not find a build job.` );
          process.env.exit( 0 );
        }
        let artifactsURL = `https://circleci.com/api/v1.1/project/gh/${process.env.CIRCLE_PROJECT_USERNAME}/${process.env.CIRCLE_PROJECT_REPONAME}/${filteredResponse[0].build_num}/artifacts`;
        // Get the artifact URL
        axios.get( artifactsURL )
          .then( function( response ) {
            buildJobArtifactURL = response.data[0].url;
          } )
          .catch( function( error ) {
            // handle error
            console.log( `${RED}Error:${RESET} ` + error );
            process.env.exit( 1 );
          } )
          .then( function() {
            resolve();
          } );
      } )
      .catch( function( error ) {
        // handle error
        console.log( `${RED}Error:${RESET} ` + error );
        process.env.exit( 1 );
      } );
  } );
}

/**
 * Run the script.
 */
async function run() {
  checkConstants();
  await authorizeUser();
  await getBuildJobArtifactURL();
  await commentOnPR();
}

const octokit = new Octokit({ auth: AUTH_TOKEN });

run();
