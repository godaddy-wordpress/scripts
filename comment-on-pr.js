const { Octokit } = require( '@octokit/core' );
const axios = require( 'axios' );
const _ = require( 'lodash' );
const { handleError, logToConsole } = require( './utils' );

// Colors
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const RESET = '\x1b[0m';

// Github Auth Token
const AUTH_TOKEN = process.env.GH_AUTH_TOKEN;

// eg: https://github.com/godaddy-wordpress/go/pull/756
const PR_ID = getPullRequestID();

let buildJobArtifactURL, finalArtifactPath;

/**
 * Check the required constants before continuing.
 */
const checkConstants = () => {
	// No auth token.
	if ( null === AUTH_TOKEN ) {
		logToConsole( `${ RED }Error:${ RESET } No Github authentication token provided (GH_AUTH_TOKEN environment variable)` );
		handleError( new Error( 'No Github authentication token provided (GH_AUTH_TOKEN environment variable)' ) );
	}

	// If this is not a pull request, no need to execute the script
	if ( null === PR_ID ) {
		logToConsole( 'This does not appear to be a pull request.' );
		handleError( new Error( 'This does not appear to be a pull request.' ) );
	}
};

/**
 * Authorize the user with Github.
 */
const authorizeUser = async () => {
	const response = await octokit.request( 'GET /user' );

	if ( null === response ) {
		logToConsole( `${ RED }Error:${ RESET } Unable to verify Github user.` );
		handleError( new Error( 'Unable to verify Github user.' ) );
	}

	const userName = response.data.login;

	logToConsole( `${ GREEN }Success:${ RESET } Successfully authenticated as ${ userName }` );
};

/**
 * Return the pull request ID from the Circle CI URL.
 *
 * @return {string} The pull request ID.
 */
const getPullRequestID = () => {
	const url = process.env.CIRCLE_PULL_REQUEST;
	const pullRequestID = url.substring( url.lastIndexOf( '/' ) + 1 );
	if ( null === pullRequestID ) {
		return null;
	}
	logToConsole( `${ GREEN }Success:${ RESET } Pull Request ID: ${ pullRequestID }` );
	return pullRequestID;
};

/**
 * Post a comment on an existing PR with a .zip attachment.
 */
const commentOnPR = async () => {
	// Create a new comment with a link to the attachment
	const comment = await octokit.request( `POST /repos/${ process.env.CIRCLE_PROJECT_USERNAME }/${ process.env.CIRCLE_PROJECT_REPONAME }/issues/${ PR_ID }/comments`, {
		body: `Download go.zip: ${ buildJobArtifactURL }`,
	} );
	if ( 201 !== comment.status ) {
		logToConsole( `${ RED }Error:${ RESET } Comment could not be created.` );
		handleError( new Error( 'Comment could not be created.' ) );
	}
	logToConsole( `${ GREEN }Success:${ RESET } Comment created.` );
	logToConsole( `View Comment: ${ comment.data.html_url }` );
};

/**
 * Get the build job artifact URL
 */
const getBuildJobArtifactURL = async () => {
	return new Promise( ( resolve ) => {
		const url = `https://circleci.com/api/v1.1/project/gh/${ process.env.CIRCLE_PROJECT_USERNAME }/${ process.env.CIRCLE_PROJECT_REPONAME }`;
		axios.get( url )
			.then( function( response ) {
				// handle success
				let filteredResponse = _.filter( response.data, { workflows: { job_name: 'build' } } ); // filter by workflow job name
				filteredResponse = _.filter( filteredResponse, { branch: process.env.CIRCLE_BRANCH } ); // ensure we only get results for this branch
				if ( null === filteredResponse || Object.keys( filteredResponse ).length < 1 ) {
					logToConsole( `${ RED }Error:${ RESET } Could not find a build job.` );
					handleError( new Error( 'Could not find a build job.' ) );
				}
				const artifactsURL = `https://circleci.com/api/v1.1/project/gh/${ process.env.CIRCLE_PROJECT_USERNAME }/${ process.env.CIRCLE_PROJECT_REPONAME }/${ filteredResponse[ 0 ].build_num }/artifacts`;
				// Get the artifact URL
				axios.get( artifactsURL )
					.then( function( artifactResponse ) {
						buildJobArtifactURL = artifactResponse.data[ 0 ].url;
					} )
					.catch( function( error ) {
						// handle error
						logToConsole( `${ RED }Error:${ RESET } ` + error );
						handleError( new Error( `${ error }` ) );
					} )
					.then( function() {
						resolve();
					} );
			} )
			.catch( function( error ) {
				// handle error
				logToConsole( `${ RED }Error:${ RESET } ` + error );
				handleError( new Error( `${ error }` ) );
			} );
	} );
};

/**
 * Run the script.
 */
const run = async () => {
	checkConstants();
	await authorizeUser();
	await getBuildJobArtifactURL();
	await commentOnPR();
};

const octokit = new Octokit( { auth: AUTH_TOKEN } );

run();
