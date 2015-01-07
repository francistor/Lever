#!/bin/bash

# If executing in openshift, rewrite the leverXXXDatabase environment variables
if [ $OPENSHIFT_MONGODB_DB_URL ]
then
    echo OPENSHIFT environment
    reOpenshift="mongodb://(.+):(.+)@(.+)/"
    reLever="mongodb://(.+)/(.+)"
    if [[ $leverConfigDatabaseURL =~ $reLever ]]; then
        configDatabase=${BASH_REMATCH[1]}
    else
        echo leverConfigDatabaseURL [$leverConfigDatabaseURL] does not match the expected format
        leverConfigDatabaseURL=
    fi

    if [[ $OPENSHIFT_MONGODB_DB_URL  =~ $reOpenshift ]]; then
        hostPort=${BASH_REMATCH[3]}
    else
        echo OPENSHIFT_MONGODB_DB_URL [$OPENSHIFT_MONGODB_DB_URL] does not match the expected format
        leverConfigDatabaseURL=
    fi

    leverConfigDatabaseURL=mongodb://${hostPort}/${configDatabase}

else
    echo STANDARD envirnonment
fi

export leverConfigDatabaseURL