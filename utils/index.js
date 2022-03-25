// use-strict;
const { Octokit } = require( '@octokit/core' );
const { createWriteStream } = require( 'fs' );
const { constants } = require( 'fs' );
const { pipeline } = require( 'stream' );
const { promisify } = require( 'util' );
const AdmZip = require( 'adm-zip' );
const fs = require( 'fs' ).promises;

const AUTH_TOKEN = process.env.GH_AUTH_TOKEN;

// Disable reason: Not sure why this is unsupported because Node 17 should support es.
// eslint-disable-next-line node/no-unsupported-features/es-syntax
const fetch = ( ...args ) => import( 'node-fetch' ).then( ( { default: asyncFetch } ) => asyncFetch( ...args ) );
const octokit = new Octokit( { auth: AUTH_TOKEN } );

// Colors
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const RESET = '\x1b[0m';

/**
 * @function download File downloader.
 * @param {string} url  The URL to download.
 * @param {string} path The path to save the file to.
 */
const download = async ( url, path ) => {
	const streamPipeline = promisify( pipeline );
	const response = await fetch( url, {
		headers: {
			// Needed to prevent 403 errors.
			'user-agent': 'Mozilla/5.0 Chrome/96 Safari/537',
		},
	} );

	if ( ! response.ok ) {
		throw new Error( `unexpected response ${ response.statusText }` );
	}

	await streamPipeline( response.body, createWriteStream( path ) );
};

/**
 * @function unzip Extract a zip file to a destination.
 * @param {*}      file
 * @param {string} path
 */
const unzip = async ( file, path ) => {
	const zip = new AdmZip( file );
	zip.extractAllTo( path, true );
};

/**
 * @function doesFileExist Async check if a inode exists and handle error messages.
 * @param {path} path Path to the inode to check
 * @return {boolean} True if the folder exists false otherwise.
 */
const doesFileExist = async ( path ) => {
	const pathWithoutTrailingSlash = path.replace( /\/$/, '' );
	// Access has no return value if file exists.
	// Catch error if occurs otherwise the file exists.
	const fileCheck = await fs.access( pathWithoutTrailingSlash, constants.F_OK ).catch( () => false );
	return fileCheck ?? true;
};

/**
 * @function handleError Handle errors and log them to the console.
 * @param {string}  error    Error event passed from script.
 * @param {boolean} graceful (optional) Whether or not to gracefully exit using process.exit().
 */
const handleError = ( error, graceful = false ) => {
	if ( graceful ) {
		logToConsole( error );
		// Disable reason. We explicitly bail of of scripts in certain situations.
		// eslint-disable-next-line no-process-exit
		process.exit( 0 );
	}
	if ( error ) {
		throw ( error );
	}
};

/**
 * @function logToConsole Log a message to the console.
 * @param {string} data The message to log.
 * @param {string} type (optional) The type of message to log.
 */
const logToConsole = ( data, type = 'log' ) => {
	if ( type === 'table' ) {
		// Disable reason: We allow table to console for explicit logging scenarios.
		// eslint-disable-next-line no-console
		console.table( data );
		return;
	}
	// Disable reason: We allow log to console for explicit logging scenarios.
	// eslint-disable-next-line no-console
	console.log( data );
};

/**
 * Return the pull request ID from the Circle CI URL.
 *
 * @return {string} The pull request ID.
 */
const getPullRequestID = () => {
	let url = process.env.CIRCLE_PULL_REQUEST;
	url = url.replace( /\/$/, '' );
	const pullRequestID = url.substring( url.lastIndexOf( '/' ) + 1 );
	if ( null === pullRequestID ) {
		return null;
	}
	greenLogMessage( `Pull Request ID: ${ pullRequestID }` );
	return pullRequestID;
};

/**
 * Loop through comment.data and find the comment with .user.login that matches `godaddy-wordpress-bot`
 * and .body including `searchString`.
 * Save the ID of the matching comment to a scoped variable if exists.
 *
 * @async
 * @param {string} searchString - The string to search for in the body.
 * @function getCommentData - Get the comment data from the PR and set a variable to reference existing comment.
 * @return {string} The comment ID || ''.
 */
const getCommentData = async ( searchString ) => {
	// eg: https://github.com/godaddy-wordpress/go/pull/756
	const PR_ID = getPullRequestID();
	const { data, status } = await octokit.request( `GET /repos/${ process.env.CIRCLE_PROJECT_USERNAME }/${ process.env.CIRCLE_PROJECT_REPONAME }/issues/${ PR_ID }/comments` );
	if ( 200 !== status || null === data ) {
		redLogMessage( 'Unable to get comment data' );
		return '';
	}

	const existingCommentData = data.find( ( comment ) => {
		return (
			comment.user.login === 'godaddy-wordpress-bot' &&
			comment.body.includes( searchString )
		);
	} );

	if ( ! existingCommentData ) {
		redLogMessage( 'Unable to find existing comment.' );
		return '';
	}
	return existingCommentData.id;
};

/**
 * Example usage: greenLogMessage( 'Success:', 'Pull Request ID: 756' );
 *
 * @function greenLogMessage Log a message to the console in green.
 * @param {*} text        Text to will be uncolored.
 * @param {*} coloredText Optional - Default is 'Success:'.
 *
 */
const greenLogMessage = ( text, coloredText = 'Success:' ) =>
	logToConsole( `${ GREEN }${ coloredText }${ RESET } ${ text }` );

/**
 * Example usage: greenLogMessage( 'Error:', 'Unable to update existing comment.' );
 *
 * @function redLogMessage Log a message to the console in green.
 * @param {*} text        Text to will be uncolored.
 * @param {*} coloredText Optional - Default is 'Error:'.
 *
 */
const redLogMessage = ( text, coloredText = 'Error:' ) =>
	logToConsole( `${ RED }${ coloredText }${ RESET } ${ text }` );

module.exports = {
	doesFileExist,
	download,
	getCommentData,
	getPullRequestID,
	greenLogMessage,
	handleError,
	logToConsole,
	redLogMessage,
	unzip,
};
