package com.tripweave.core.database

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase

@Database(
    entities = [
        TripEntity::class,
        TripStopEntity::class,
        ExpenseEntity::class,
        SyncOutboxEntity::class
    ],
    version = 1,
    exportSchema = false
)
abstract class TripWeaveDatabase : RoomDatabase() {
    abstract fun tripDao(): TripDao
    abstract fun tripStopDao(): TripStopDao
    abstract fun expenseDao(): ExpenseDao
    abstract fun syncOutboxDao(): SyncOutboxDao

    companion object {
        @Volatile
        private var INSTANCE: TripWeaveDatabase? = null

        fun getInstance(context: Context): TripWeaveDatabase {
            return INSTANCE ?: synchronized(this) {
                val instance = Room.databaseBuilder(
                    context.applicationContext,
                    TripWeaveDatabase::class.java,
                    "tripweave_db"
                ).fallbackToDestructiveMigration().build()
                INSTANCE = instance
                instance
            }
        }
    }
}
