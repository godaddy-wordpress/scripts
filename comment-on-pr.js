( async () => {
	// use-strict;
	const { Octokit } = require( '@octokit/core' );
	const axios = require( 'axios' );
	const { filter } = require( 'lodash' );
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
	let buildJobArtifactURL;

	let EXISTING_COMMENT_ID = '';

	/**
	 * Check the required constants before continuing.
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
	 * Parameter artifactURL should be used to PATCH the existing comment.
	 *
	 * @async
	 * @function updateExistingComment - Update an existing comment.
	 * @param {string} artifactURL - The URL to the artifact.
	 * @return {boolean} - True if successful.
	 */
	const updateExistingComment = async ( artifactURL ) => {
		if ( ! EXISTING_COMMENT_ID ) {
			redLogMessage( 'Unable to update existing comment.' );
			return false;
		}

		const { data, status } = await octokit.request( `PATCH /repos/${ process.env.CIRCLE_PROJECT_USERNAME }/${ process.env.CIRCLE_PROJECT_REPONAME }/issues/comments/${ EXISTING_COMMENT_ID }`, {
			body: `Download ${ process.env.CIRCLE_PROJECT_REPONAME }.zip: ${ artifactURL }`,
		} );

		if ( 200 !== status || null === data ) {
			redLogMessage( 'Unable to update existing comment.' );
			return false;
		}
		greenLogMessage( 'Updated existing comment.' );
		return true;
	};

	/**
	 * Post a comment on an existing PR with a .zip attachment.
	 */
	const commentOnPR = async () => {
		/**
		 * If the comment already exists, update it.
		 */
		if ( await updateExistingComment( buildJobArtifactURL ) === true ) {
			return;
		}

		// Create a new comment with a link to the attachment
		const comment = await octokit.request( `POST /repos/${ process.env.CIRCLE_PROJECT_USERNAME }/${ process.env.CIRCLE_PROJECT_REPONAME }/issues/${ PR_ID }/comments`, {
			body: `Download ${ process.env.CIRCLE_PROJECT_REPONAME }.zip: ${ buildJobArtifactURL }`,
		} );
		if ( 201 !== comment.status ) {
			redLogMessage( 'Comment could not be created.' );
			handleError( new Error( 'Comment could not be created.' ) );
		}
		greenLogMessage( 'Comment created.' );
		greenLogMessage( comment.data.html_url, 'View Comment:' );
	};

	/**
	 * Get the build job artifact URL
	 * Todo - We should refactor this to promises.
	 */
	const getBuildJobArtifactURL = async () => {
		return new Promise( ( resolve ) => {
			const url = `https://circleci.com/api/v1.1/project/gh/${ process.env.CIRCLE_PROJECT_USERNAME }/${ process.env.CIRCLE_PROJECT_REPONAME }`;
			axios.get( url )
				.then( function( response ) {
				// handle success
					let filteredResponse = filter( response.data, { workflows: { job_name: 'build' } } ); // filter by workflow job name
					filteredResponse = filter( filteredResponse, { branch: process.env.CIRCLE_BRANCH } ); // ensure we only get results for this branch
					if ( null === filteredResponse || Object.keys( filteredResponse ).length < 1 ) {
						redLogMessage( 'Could not find a build job.' );
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
							redLogMessage( error );
							handleError( new Error( `${ error }` ) );
						} )
						.then( function() {
							resolve();
						} );
				} )
				.catch( function( error ) {
				// handle error
					redLogMessage( error );
					handleError( new Error( `${ error }` ) );
				} );
		} );
	};

	checkConstants();
	await authorizeUser();
	await getBuildJobArtifactURL();
	EXISTING_COMMENT_ID = await getCommentData( 'Download' );
	await commentOnPR();
} )();
