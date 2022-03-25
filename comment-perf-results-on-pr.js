
( async () => {
	// use-strict;
	const { Octokit } = require( '@octokit/core' );
	const fs = require( 'fs' ).promises;
	const os = require( 'os' );
	const {
		getCommentData,
		getPullRequestID,
		greenLogMessage,
		handleError,
		logToConsole,
		redLogMessage,
	} = require( './utils' );

	// Github Auth Token
	const AUTH_TOKEN = process.env.GH_AUTH_TOKEN;

	// eg: https://github.com/godaddy-wordpress/go/pull/756
	const PR_ID = getPullRequestID();

	const octokit = new Octokit( { auth: AUTH_TOKEN } );
	const EXISTING_COMMENT_ID = '';

	/**
	 * @function checkConstants - Check the required constants before continuing.
	 */
	const checkConstants = () => {
	// No auth token.
		if ( null === AUTH_TOKEN ) {
			redLogMessage( 'No Github authentication token provided (GH_AUTH_TOKEN environment variable)' );
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
	 *
	 * @async
	 * @function authorizeUser - Authorize the user with Github.
	 * @return {Promise<void>}
	 */
	const authorizeUser = async () => {
		const response = await octokit.request( 'GET /user' );

		if ( null === response ) {
			redLogMessage( 'Unable to verify Github user.' );
			handleError( new Error( 'Unable to verify Github user.' ) );
		}

		const userName = response.data.login;
		greenLogMessage( `Successfully authenticated as ${ userName }` );
	};

	/**
	 * Patch the comment on the PR. Return true if the patch was successful and false if it failed.
	 * Function should depend on `EXISTING_COMMENT_ID` being set return false otherwise.
	 * Parameter perfResults should be used to PATCH the existing comment.
	 *
	 * @async
	 * @function updateExistingComment - Update an existing comment.
	 * @param {string} perfResults - The performance test results to be posted.
	 * @return {boolean} - True if successful.
	 */
	const updateExistingComment = async ( perfResults ) => {
		if ( ! EXISTING_COMMENT_ID ) {
			redLogMessage( 'Unable to update existing comment.' );
			return false;
		}

		const { data, status } = await octokit.request( `PATCH /repos/${ process.env.CIRCLE_PROJECT_USERNAME }/${ process.env.CIRCLE_PROJECT_REPONAME }/issues/comments/${ EXISTING_COMMENT_ID }`, {
			body: '## Performance Test Results: \r\n' + perfResults,
		} );

		if ( 200 !== status || null === data ) {
			redLogMessage( 'Unable to update existing comment.' );
			return false;
		}
		greenLogMessage( 'Updated existing comment.' );
		return true;
	};

	/**
	 * Comment on the PR.
	 *
	 * @async
	 * @function commentOnPR - Comment on the PR.
	 * @return {Promise<void>}
	 */
	const commentOnPR = async () => {
		const rawPerfResults = await fs.readFile(
			`${ os.homedir() }/project/post-editor-performance-results.txt`,
			'utf8',
		);

		// Replace \\r\\n with \r\n.
		const perfResults = rawPerfResults.replaceAll( '\\r\\n', '\r\n' );

		greenLogMessage( perfResults, 'perfResults' );

		/**
		 * If the comment already exists, update it.
		 */
		if ( await updateExistingComment( perfResults ) === true ) {
			return;
		}

		// Create a new comment with a link to the attachment or update an existing comment.
		const comment = await octokit.request( `POST /repos/${ process.env.CIRCLE_PROJECT_USERNAME }/${ process.env.CIRCLE_PROJECT_REPONAME }/issues/${ PR_ID }/comments`, {
			body: `## Performance Test Results: <br /> ${ perfResults }`,
		} );

		if ( 201 !== comment.status ) {
			redLogMessage( 'Comment could not be created.' );
			handleError( new Error( 'Comment could not be created.' ) );
		}
		greenLogMessage( 'Comment created.' );
		greenLogMessage( comment.data.html_url, 'View Comment: ' );
	};

	checkConstants();
	await authorizeUser();
	await getCommentData( 'Performance Test Results' );
	await commentOnPR();
} )();

