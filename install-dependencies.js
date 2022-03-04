const { exec } = require( 'child_process' );
const { handleError, logToConsole } = require( './utils' );

exec( 'sudo apt-get update && sudo apt-get install -y subversion default-mysql-client',
	( error, stdout, stderr ) => {
		handleError( error );
		handleError( stderr );
		logToConsole( stdout );
	} );

exec( "node ./install-wp-tests.js wordpress_test root '' 127.0.0.1 latest",
	( error, stdout, stderr ) => {
		handleError( error );
		handleError( stderr );
		logToConsole( stdout );
	} );
