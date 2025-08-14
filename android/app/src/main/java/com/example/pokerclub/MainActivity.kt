package com.example.pokerclub

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.*
import okhttp3.* // OkHttp 4/5 compatible
import okhttp3.HttpUrl.Companion.toHttpUrlOrNull
import java.util.concurrent.TimeUnit

class MainActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val deepLink = intent?.dataString
        setContent { PokerApp(initialDeepLink = deepLink) }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setContent { PokerApp(initialDeepLink = intent.dataString) }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PokerApp(initialDeepLink: String? = null) {
    // ---- Basic state
    var server by remember { mutableStateOf("") }             // e.g. wss://flashpoker.co.uk/ws
    var tableId by remember { mutableStateOf("") }
    var userId by remember { mutableStateOf("") }

    val client = remember {
        OkHttpClient.Builder()
            .readTimeout(0, TimeUnit.MILLISECONDS) // ws never times out
            .build()
    }
    var webSocket by remember { mutableStateOf<WebSocket?>(null) }
    var log by remember { mutableStateOf("Idle") }

    // ---- Deep link handling (token -> tableId, server)
    val scope = rememberCoroutineScope()
    LaunchedEffect(initialDeepLink) {
        val s = initialDeepLink ?: return@LaunchedEffect
        try {
            val uri = Uri.parse(s)
            // Accept custom scheme pokerclub://join?... and https://flashpoker.co.uk/join?... too
            val isJoin = (uri.scheme == "pokerclub" && uri.host == "join") ||
                    ((uri.scheme == "https" || uri.scheme == "http") && (uri.path?.startsWith("/join") == true))
            if (isJoin) {
                uri.getQueryParameter("server")?.let { server = it }
                val token = uri.getQueryParameter("token")
                if (token != null) {
                    // Resolve token -> tableId via REST
                    val http = server.replace("wss://", "https://").replace("ws://", "http://").removeSuffix("/ws")
                    scope.launch {
                        val tId = resolveInvite(http, token, client)
                        if (tId != null) tableId = tId
                    }
                } else {
                    uri.getQueryParameter("tableId")?.let { tableId = it }
                }
                uri.getQueryParameter("userId")?.let { userId = it }
            }
        } catch (_: Throwable) { /* ignore */ }
    }

    // ---- UI
    MaterialTheme {
        Scaffold(
            topBar = {
                TopAppBar(title = { Text("FlashPoker") })
            }
        ) { pad ->
            Column(
                Modifier
                    .fillMaxSize()
                    .padding(pad)
                    .padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {

                OutlinedTextField(
                    value = server,
                    onValueChange = { server = it },
                    label = { Text("Server WebSocket URL") },
                    placeholder = { Text("wss://flashpoker.co.uk/ws") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )

                OutlinedTextField(
                    value = tableId,
                    onValueChange = { tableId = it },
                    label = { Text("Table ID") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )

                OutlinedTextField(
                    value = userId,
                    onValueChange = { userId = it },
                    label = { Text("User ID") },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Ascii),
                    modifier = Modifier.fillMaxWidth()
                )

                Row(
                    Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Button(
                        onClick = {
                            val wsUrl = server
                            val ok = wsUrl.toHttpUrlOrNull()
                            if (ok == null || !(wsUrl.startsWith("ws://") || wsUrl.startsWith("wss://"))) {
                                log = "Invalid WS URL"
                                return@Button
                            }
                            if (tableId.isBlank() || userId.isBlank()) {
                                log = "Please enter tableId and userId"
                                return@Button
                            }
                            val req = Request.Builder()
                                .url(wsUrl)
                                .build()
                            val listener = object : WebSocketListener() {
                                override fun onOpen(webSocket: WebSocket, response: Response) {
                                    log = "Connected"
                                    // Example: send a hello or join message if your server expects one
                                    // webSocket.send("""{"type":"HELLO","tableId":"$tableId","userId":"$userId"}""")
                                }
                                override fun onMessage(webSocket: WebSocket, text: String) {
                                    log = "Recv: $text"
                                }
                                override fun onClosing(webSocket: WebSocket, code: Int, reason: String) {
                                    log = "Closing: $code $reason"
                                    webSocket.close(1000, null)
                                }
                                override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
                                    log = "Error: ${t.message}"
                                }
                            }
                            webSocket = client.newWebSocket(req, listener)
                        }
                    ) { Text("Connect") }

                    Button(
                        onClick = {
                            webSocket?.close(1000, "bye")
                            log = "Disconnected"
                        },
                        enabled = webSocket != null
                    ) { Text("Disconnect") }
                }

                Divider()

                Text("Log:", style = MaterialTheme.typography.labelLarge)
                Text(
                    log,
                    modifier = Modifier
                        .fillMaxWidth()
                        .heightIn(min = 80.dp)
                )
            }
        }
    }
}

/** Resolve invite token to tableId via GET /invites/:token (http base) */
private suspend fun resolveInvite(httpBase: String, token: String, client: OkHttpClient): String? {
    return withContext(Dispatchers.IO) {
        try {
            val url = "$httpBase/invites/$token"
            val req = Request.Builder().url(url).get().build()
            client.newCall(req).execute().use { resp ->
                if (!resp.isSuccessful) return@use null
                val bodyText = resp.body?.string().orEmpty()
                val obj = Json.parseToJsonElement(bodyText).jsonObject
                obj["tableId"]?.jsonPrimitive?.content
            }
        } catch (_: Throwable) { null }
    }
}
