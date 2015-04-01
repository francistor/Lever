#!/bin/bash
#  --------------------------------------------------------------
#  LEVER RADIUS TEST
#  Usage testRadius.sh <auth|acct|all> <count>
#  --------------------------------------------------------------

AAABASEDIR=/home/francisco/AAA

# Usually this need not be changed
_THIS_FILE_PATH=$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )
TESTFILES=_THIS_FILE_PATH
BINDIR=${AAABASEDIR}/bin
RUNDIR=${AAABASEDIR}/run
RADIUS=${BINDIR}/aaa-rt
DIAMETER=${BINDIR}/aaa-dt

RADIUSAUTH="${BINDIR}/aaa-rt -remoteAddress 127.0.0.1:1812"
RADIUSACCT="${BINDIR}/aaa-rt -remoteAddress 127.0.0.1:1812"
COMMAND="${BINDIR}/aaa-cmd -login admin -password admin"
AWK=awk

#  Test parameters
Secret=secret
REQUESTFILE=${_THIS_FILE_PATH}/request.txt

User_Name=miusuario@midominio
NAS_IP_Address=3.3.3.3
NAS_Port=\"1\"
Acct_Session_Id=1-1
Framed_IP_Address=10.0.0.1

command=${1:-all}
count=${2:-1}
overlap=1

#  Delete Garbage
rm out/* > /dev/null 2>&1

if [ ${command} = "auth" ] || [ ${command} = "all" ];
then

    #  Access request -------------------------------------------------------------
    echo
    echo Access request
    echo

    #  Compose the packet
    echo User-Name=${User_Name} > ${REQUESTFILE}
    echo Acct-Session-Id=${Acct_Session_Id} >> ${REQUESTFILE}
    echo NAS-IP-Address=${NAS_IP_Address} >> ${REQUESTFILE}
    echo NAS-Port=${NAS_Port} >> ${REQUESTFILE}

    #  Send the packet
    ${RADIUSAUTH} -count ${count} -overlap ${overlap} -debug debug -secret ${Secret} -code Access-Request -request @${REQUESTFILE} -outputAttributesFile ${TESTFILES}\out\access-request.txt

fi

if [ ${command} = "acct"  ] || [ ${command} = "all" ];
then

    #  Account Start -------------------------------------------------------------
    echo
    echo Account start
    echo

    #  Compose the packet
    echo User-Name=${User_Name}>${REQUESTFILE}
    echo Acct-Session-Id=${Acct_Session_Id}>>${REQUESTFILE}
    echo NAS-IP-Address=${NAS_IP_Address}>>${REQUESTFILE}
    echo NAS-Port=${NAS_Port}>>${REQUESTFILE}
    echo Acct-Status-Type="Start">>${REQUESTFILE}

    #  Send the packet
    ${RADIUSACCT} -count ${count} -overlap ${overlap} -debug debug -secret ${Secret} -code Accounting-Request -request @${REQUESTFILE} -outputAttributesFile ${TESTFILES}\out\account-start.txt

fi
exit


