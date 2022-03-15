const { Octokit } = require( '@octokit/core' );
const fs = require( 'fs' ).promises;
const os = require( 'os' );
const { handleError, logToConsole, getPullRequestID } = require( './utils' );

// Colors
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const RESET = '\x1b[0m';

// Github Auth Token
const AUTH_TOKEN = process.env.GH_AUTH_TOKEN;

// eg: https://github.com/godaddy-wordpress/go/pull/756
const PR_ID = getPullRequestID();

const octokit = new Octokit( { auth: AUTH_TOKEN } );

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
 * Post a comment on an existing PR with a .zip attachment.
 */
const commentOnPR = async () => {
	const perfResults = await fs.readFile( `${ os.homedir() }/project/post-editor-performance-results.txt`, 'utf8' );
	logToConsole( `${ GREEN }perfResults:${ RESET } ${ perfResults }` );

	// Create a new comment with a link to the attachment
	const comment = await octokit.request( `POST /repos/${ process.env.CIRCLE_PROJECT_USERNAME }/${ process.env.CIRCLE_PROJECT_REPONAME }/issues/${ PR_ID }/comments`, {
		body: `## Performance Test Results: \r\n '${ perfResults }'`,
	} );
	if ( 201 !== comment.status ) {
		logToConsole( `${ RED }Error:${ RESET } Comment could not be created.` );
		handleError( new Error( 'Comment could not be created.' ) );
	}
	logToConsole( `${ GREEN }Success:${ RESET } Comment created.` );
	logToConsole( `View Comment: ${ comment.data.html_url }` );
};

/**
 * Run the script.
 */
const run = async () => {
	checkConstants();
	await authorizeUser();
	await commentOnPR();
};

run();
