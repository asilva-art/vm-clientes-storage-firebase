on run argv
  set senderAddress to item 1 of argv
  set recipientsBlob to item 2 of argv
  set subjectText to item 3 of argv
  set bodyText to item 4 of argv

  tell application "Mail"
    set newMessage to make new outgoing message with properties {visible:false, subject:subjectText, content:bodyText & return & return}

    tell newMessage
      set sender to senderAddress

      repeat with oneAddress in paragraphs of recipientsBlob
        if (contents of oneAddress) is not "" then
          make new to recipient at end of to recipients with properties {address:contents of oneAddress}
        end if
      end repeat

      send
    end tell
  end tell

  return "ok"
end run
