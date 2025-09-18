package at.kmlite.pfrpg2e.settings

import at.kmlite.pfrpg2e.Config
import at.kmlite.pfrpg2e.data.checks.RollMode
import at.kmlite.pfrpg2e.data.kingdom.KingdomSizeType
import at.kmlite.pfrpg2e.fromCamelCase
import at.kmlite.pfrpg2e.toCamelCase
import at.kmlite.pfrpg2e.utils.newInstance
import at.kmlite.pfrpg2e.utils.t
import at.kmlite.pfrpg2e.utils.toMutableRecord
import com.foundryvtt.core.abstract.DataModel
import com.foundryvtt.core.applications.api.ApplicationV2
import com.foundryvtt.core.game
import com.foundryvtt.core.helpers.ClientSettings
import com.foundryvtt.core.helpers.SettingsData
import com.foundryvtt.core.helpers.SettingsMenuData
import js.core.JsNumber
import js.objects.ReadonlyRecord
import kotlinx.coroutines.await

enum class SettingsScope {
    CLIENT,
    WORLD;

    companion object {
        fun fromString(value: String) = fromCamelCase<KingdomSizeType>(value)
    }

    val value: String
        get() = toCamelCase()
}

inline fun <reified T : DataModel> ClientSettings.registerDataModel(
    key: String,
    name: String,
    hint: String? = undefined,
    requiresReload: Boolean = false,
) {
    register(
        Config.moduleId,
        key,
        SettingsData(
            name = name,
            hint = hint,
            config = false,
            requiresReload = requiresReload,
            default = T::class.js.newInstance(emptyArray()).toObject(),
            type = T::class.js,
            scope = "world"
        )
    )
}

fun ClientSettings.registerInt(
    key: String,
    name: String,
    hint: String? = undefined,
    default: Int = 0,
    hidden: Boolean = false,
    requiresReload: Boolean = false,
    choices: ReadonlyRecord<String, Int>? = undefined,
) {
    register(
        Config.moduleId,
        key,
        SettingsData(
            name = name,
            hint = hint,
            config = !hidden,
            default = default,
            requiresReload = requiresReload,
            type = JsNumber::class.js,
            scope = "world",
            choices = choices,
        )
    )
}

inline fun <reified T : Any> ClientSettings.registerScalar(
    key: String,
    name: String,
    hint: String? = undefined,
    default: T? = undefined,
    hidden: Boolean = false,
    requiresReload: Boolean = false,
    choices: ReadonlyRecord<String, T>? = undefined,
    scope: SettingsScope = SettingsScope.WORLD,
) {
    register(
        Config.moduleId,
        key,
        SettingsData(
            name = name,
            hint = hint,
            config = !hidden,
            default = default,
            requiresReload = requiresReload,
            type = T::class.js,
            scope = scope.value,
            choices = choices,
        )
    )
}

fun ClientSettings.createMenu(
    key: String,
    name: String,
    label: String,
    hint: String? = undefined,
    icon: String? = undefined,
    restricted: Boolean = false,
    app: JsClass<out ApplicationV2>
) {
    registerMenu(
        Config.moduleId,
        key,
        SettingsMenuData(
            name = name,
            label = label,
            hint = hint,
            icon = icon,
            type = app,
            restricted = restricted,
        )
    )
}

fun ClientSettings.getInt(key: String): Int =
    get(Config.moduleId, key)

suspend fun ClientSettings.setInt(key: String, value: Int) {
    set(Config.moduleId, key, value).await()
}

fun ClientSettings.getString(key: String): String =
    get(Config.moduleId, key)

suspend fun ClientSettings.setString(key: String, value: String) {
    set(Config.moduleId, key, value).await()
}

fun ClientSettings.getNullableString(key: String): String? =
    get(Config.moduleId, key)

suspend fun ClientSettings.setNullableString(key: String, value: String?) {
    set(Config.moduleId, key, value).await()
}


fun ClientSettings.getBoolean(key: String): Boolean =
    get(Config.moduleId, key)

suspend fun ClientSettings.setBoolean(key: String, value: Boolean) {
    set(Config.moduleId, key, value).await()
}

fun <T : Any> ClientSettings.getObject(key: String): T =
    get(Config.moduleId, key)

suspend fun ClientSettings.setObject(key: String, value: Any) {
    set(Config.moduleId, key, value).await()
}

val ClientSettings.pfrpg2eKingdomCampingWeather: Pfrpg2eKingdomCampingWeatherSettings
    get() = Pfrpg2eKingdomCampingWeatherSettings

@Suppress("unused", "ClassName")
object Pfrpg2eKingdomCampingWeatherSettings {
    suspend fun setKingdomActiveLeader(value: String?) =
        game.settings.setNullableString("kingdomActiveLeader", value)

    fun getKingdomActiveLeader(): String? =
        game.settings.getNullableString("kingdomActiveLeader")

    suspend fun setEnableAfterCombatDialog(value: Boolean) =
        game.settings.setBoolean("enableAfterCombatDialog", value)

    fun getEnableAfterCombatDialog(): Boolean =
        game.settings.getBoolean("enableAfterCombatDialog")

    suspend fun setEnablePartyActorIcons(value: Boolean) =
        game.settings.setBoolean("enablePartyActorIcons", value)

    fun getEnablePartyActorIcons(): Boolean =
        game.settings.getBoolean("enablePartyActorIcons")

    suspend fun setEnableTokenMapping(value: Boolean) =
        game.settings.setBoolean("enableTokenMapping", value)

    fun getEnableTokenMapping(): Boolean =
        game.settings.getBoolean("enableTokenMapping")

    suspend fun setLatestMigrationBackup(value: String) =
        game.settings.setString("latestMigrationBackup", value)

    fun getLatestMigrationBackup(): String =
        game.settings.getString("latestMigrationBackup")

    suspend fun setSchemaVersion(value: Int) =
        game.settings.setInt("schemaVersion", value)

    fun getSchemaVersion(): Int =
        game.settings.getInt("schemaVersion")


    suspend fun setEnableCombatTracks(value: Boolean) =
        game.settings.setBoolean("enableCombatTracks", value)

    fun getEnableCombatTracks(): Boolean =
        game.settings.getBoolean("enableCombatTracks")

    suspend fun setDisableFirstRunMessage(value: Boolean) =
        game.settings.setBoolean("disableFirstRunMessage", value)

    fun getDisableFirstRunMessage(): Boolean =
        game.settings.getBoolean("disableFirstRunMessage")


    fun getHideBuiltinKingdomSheet(): Boolean =
        game.settings.getBoolean("hideBuiltinKingdomSheet")

    suspend fun setHideBuiltinKingdomSheet(value: Boolean) =
        game.settings.setBoolean("hideBuiltinKingdomSheet", value)


    private object nonUserVisibleSettings {
        val booleans = mapOf<String, Boolean>()
        val strings = mapOf(
            "latestMigrationBackup" to "{}"
        )
    }


    fun register() {
        registerSimple(game.settings, nonUserVisibleSettings.strings, hidden = true)
        registerSimple(game.settings, nonUserVisibleSettings.booleans, hidden = true)
        game.settings.registerScalar(
            key = "enableAfterCombatDialog",
            name = t("settings.enableAfterCombatDialog"),
            hint = t("settings.enableAfterCombatDialogHelp"),
            default = true,
            requiresReload = false,
        )
        game.settings.registerScalar(
            key = "hideBuiltinKingdomSheet",
            name = t("settings.hideBuiltinKingdomSheet"),
            hint = t("settings.hideBuiltinKingdomSheetHelp"),
            default = false,
            requiresReload = true,
        )
        game.settings.registerScalar(
            key = "disableFirstRunMessage",
            name = t("settings.disableFirstRunMessage"),
            hint = t("settings.disableFirstRunMessageHelp"),
            default = false,
            requiresReload = true,
        )
        game.settings.registerScalar<String>(
            key = "kingdomActiveLeader",
            name = t("settings.kingdomActiveLeader"),
            default = null,
            hidden = true,
            scope = SettingsScope.CLIENT,
        )
        game.settings.registerInt(
            key = "schemaVersion",
            name = t("settings.schemaVersion"),
            hidden = false,
            hint = t("settings.schemaVersionHelp")
        )
        game.settings.registerScalar(
            name = t("settings.enablePartyActorIcons"),
            key = "enablePartyActorIcons",
            hint = t("settings.enablePartyActorIconsHelp"),
            default = true,
            requiresReload = true,
        )
        game.settings.registerScalar<Boolean>(
            key = "enableCombatTracks",
            name = t("settings.enableCombatTracks"),
            hint = t("settings.enableCombatTracksHelp"),
            default = true,
        )
        game.settings.registerScalar<Boolean>(
            key = "enableTokenMapping",
            name = t("settings.enableTokenMapping"),
            hint = t("settings.enableTokenMappingHelp"),
            default = true,
            requiresReload = true,
        )
    }
}


private inline fun <reified T : Any> registerSimple(
    settings: ClientSettings,
    values: Map<String, T>,
    hidden: Boolean,
) {
    values.forEach { (key, value) ->
        settings.registerScalar<T>(
            key = key,
            default = value,
            name = key,
            hidden = hidden,
        )
    }
}
