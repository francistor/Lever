#!/bin/bash

# --------------------------------------------------------------
# Gx TEST for Lever project
# --------------------------------------------------------------

AAABASEDIR=/home/francisco/AAA

# Usually this need not be changed
_THIS_FILE_PATH=$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )
BINDIR=${AAABASEDIR}/bin
RUNDIR=${AAABASEDIR}/run
RADIUS=${BINDIR}/aaa-rt
DIAMETER=${BINDIR}/aaa-dt
AWK=awk

ORIGIN_HOST=diameterTool
APPLICATION_ID=Credit-Control
DESTINATION_HOST=lever-samsung
DESTINATION_ADDRESS=127.0.0.1:3868

# Test parameters
REQUESTFILE=${_THIS_FILE_PATH}/request.txt

COUNT=20

# Delete Garbage
rm out/*>/dev/null 2>&1

# Diameter Gx CCR -------------------------------------------------------------
echo
echo Access request
echo

echo Session-Id = \"session-id-1\" > ${REQUESTFILE}
echo CC-Request-Type = 1 >> ${REQUESTFILE}
echo CC-Request-Number = 1 >> ${REQUESTFILE}
echo Subscription-Id = \"Subscription-Id-Type=1, Subscription-Id-Data=913374871\" >> ${REQUESTFILE}

# Send the packet
${DIAMETER} -debug verbose -count ${COUNT} -oh ${ORIGIN_HOST} -dh ${DESTINATION_HOST} -destinationAddress ${DESTINATION_ADDRESS} -Application ${APPLICATION_ID} -command Credit-Control -request @${REQUESTFILE}
