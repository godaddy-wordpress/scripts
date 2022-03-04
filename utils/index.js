const { createWriteStream } = require( 'fs' );
const { pipeline } = require( 'stream' );
const { promisify } = require( 'util' );
const AdmZip = require( 'adm-zip' );
const fs = require( 'fs' ).promises;

// Disable reason: Not sure why this is unsupported because Node 17 should support es.
// eslint-disable-next-line node/no-unsupported-features/es-syntax
const fetch = ( ...args ) => import( 'node-fetch' ).then( ( { default: asyncFetch } ) => asyncFetch( ...args ) );

const download = async ( url, path ) => {
	const streamPipeline = promisify( pipeline );

	const response = await fetch( url );

	if ( ! response.ok ) {
		throw new Error( `unexpected response ${ response.statusText }` );
	}

	await streamPipeline( response.body, createWriteStream( path ) );
};

const unzip = async ( file, path ) => {
	const zip = new AdmZip( file );
	zip.extractAllTo( path, true );
};

const doesFileExist = async ( path ) => {
	try {
		await fs.access( path, fs.F_OK );
		return true;
	} catch ( err ) {
		return false;
	}
};

const handleError = ( error ) => {
	if ( error ) {
		throw ( error );
	}
};

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
	// Colors
	const GREEN = '\x1b[32m';
	const RESET = '\x1b[0m';

	let url = process.env.CIRCLE_PULL_REQUEST;
	url = url.replace( /\/$/, '' );
	const pullRequestID = url.substring( url.lastIndexOf( '/' ) + 1 );
	if ( null === pullRequestID ) {
		return null;
	}
	logToConsole( `${ GREEN }Success:${ RESET } Pull Request ID: ${ pullRequestID }` );
	return pullRequestID;
};

exports.download = download;
exports.unzip = unzip;
exports.doesFileExist = doesFileExist;
exports.handleError = handleError;
exports.logToConsole = logToConsole;
exports.getPullRequestID = getPullRequestID;
