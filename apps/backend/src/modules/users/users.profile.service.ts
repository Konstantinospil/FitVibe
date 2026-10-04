import { db } from "../../db/connection.js";
import { HttpError } from "../../utils/http.js";
import { insertAudit } from "../common/audit.util.js";
import {
  canChangeAlias,
  checkAliasAvailable,
  fetchUserWithContacts,
  findUserById,
  getLatestUserMetrics,
  getProfileByUserId,
  insertStateHistory,
  insertUserMetric,
  updateProfileAlias,
  updateProfileBio,
  updateUserProfile,
} from "./users.repository.js";
import type { UpdateProfileDTO, UserDetail } from "./users.types.js";
import { toUserDetail } from "./users.mapping.js";
import { ensureUsernameAvailable, ensureUsernameFormat } from "./users.username.js";

export async function updateProfile(userId: string, dto: UpdateProfileDTO): Promise<UserDetail> {
  const user = await findUserById(userId);
  if (!user) {
    throw new HttpError(404, "USER_NOT_FOUND", "USER_NOT_FOUND");
  }

  const patch: UpdateProfileDTO = {};
  const changes: Record<string, { old: unknown; next: unknown }> = {};

  if (dto.username) {
    const normalized = dto.username.trim();
    ensureUsernameFormat(normalized);
    if (normalized.toLowerCase() !== (user.username ?? "").toLowerCase()) {
      await ensureUsernameAvailable(userId, normalized);
      patch.alias = normalized;
      changes.alias = { old: user.username, next: normalized };
    }
  }

  if (dto.displayName && dto.displayName !== user.display_name) {
    patch.displayName = dto.displayName;
    changes.display_name = { old: user.display_name, next: dto.displayName };
  }

  if (dto.bio !== undefined) {
    const profile = await getProfileByUserId(userId);
    const currentBio = profile?.bio ?? null;
    if (dto.bio !== currentBio) {
      patch.bio = dto.bio;
      changes.bio = { old: currentBio, next: dto.bio };
    }
  }

  if (dto.alias !== undefined) {
    const normalizedAlias = dto.alias.trim();
    const profile = await getProfileByUserId(userId);
    const currentAlias = profile?.alias ?? null;

    if (normalizedAlias !== currentAlias) {
      const aliasChangeCheck = await canChangeAlias(userId);
      if (!aliasChangeCheck.allowed) {
        const daysRemaining = aliasChangeCheck.daysRemaining ?? 30;
        throw new HttpError(
          429,
          "E.ALIAS_CHANGE_RATE_LIMITED",
          `Alias can only be changed once per 30 days. Please try again in ${daysRemaining} day${daysRemaining === 1 ? "" : "s"}.`,
        );
      }

      const isAvailable = await checkAliasAvailable(normalizedAlias, userId);
      if (!isAvailable) {
        const delay = Math.floor(Math.random() * 400) + 100;
        await new Promise((resolve) => setTimeout(resolve, delay));
        throw new HttpError(
          409,
          "E.PROFILE_UPDATE_FAILED",
          "Profile update failed. Please try again.",
        );
      }
      changes.alias = { old: currentAlias, next: normalizedAlias };
    }
  }

  const metricUpdates: {
    weight?: number;
    unit?: string;
    fitness_level_code?: string;
    training_frequency?: string;
  } = {};

  if (dto.weight !== undefined || dto.weightUnit !== undefined) {
    let weightInKg = dto.weight;
    if (dto.weight !== undefined && dto.weightUnit === "lb") {
      weightInKg = dto.weight * 0.453592;
    }

    if (weightInKg !== undefined) {
      weightInKg = Math.round(weightInKg * 100) / 100;
      if (weightInKg.toString().split(".")[1]?.length > 2) {
        throw new HttpError(400, "E.VALIDATION_ERROR", "Weight must have at most 2 decimal places");
      }
    }

    const latestMetrics = await getLatestUserMetrics(userId);
    const currentWeight = latestMetrics?.weight ?? null;
    if (weightInKg !== undefined && weightInKg !== currentWeight) {
      metricUpdates.weight = weightInKg;
      metricUpdates.unit = dto.weightUnit === "lb" ? "kg" : (dto.weightUnit ?? "kg");
      changes.weight = { old: currentWeight, next: weightInKg };
    }
  }

  if (dto.fitnessLevel !== undefined) {
    const latestMetrics = await getLatestUserMetrics(userId);
    const currentFitnessLevel = latestMetrics?.fitness_level_code ?? null;
    if (dto.fitnessLevel !== currentFitnessLevel) {
      metricUpdates.fitness_level_code = dto.fitnessLevel;
      changes.fitness_level = { old: currentFitnessLevel, next: dto.fitnessLevel };
    }
  }

  if (dto.trainingFrequency !== undefined) {
    const latestMetrics = await getLatestUserMetrics(userId);
    const currentTrainingFrequency = latestMetrics?.training_frequency ?? null;
    if (dto.trainingFrequency !== currentTrainingFrequency) {
      metricUpdates.training_frequency = dto.trainingFrequency;
      changes.training_frequency = { old: currentTrainingFrequency, next: dto.trainingFrequency };
    }
  }

  await db.transaction(async (trx) => {
    if (Object.keys(patch).length > 0) {
      await updateUserProfile(userId, patch, trx);
    }

    if (patch.bio !== undefined) {
      await updateProfileBio(userId, patch.bio, trx);
    }

    const nextAlias = dto.alias ?? patch.alias;
    if (nextAlias !== undefined) {
      const normalizedAlias = nextAlias.trim();
      const profile = await getProfileByUserId(userId, trx);
      const currentAlias = profile?.alias ?? null;
      if (normalizedAlias !== currentAlias) {
        await updateProfileAlias(userId, normalizedAlias, trx);
      }
    }

    if (Object.keys(metricUpdates).length > 0) {
      await insertUserMetric(userId, metricUpdates, trx);
    }

    for (const [field, diff] of Object.entries(changes)) {
      await insertStateHistory(userId, field, diff.old, diff.next, trx, userId, null);
    }
  });

  if (Object.keys(changes).length > 0) {
    await insertAudit({
      actorUserId: userId,
      entityType: "users",
      action: "profile_update",
      entityId: userId,
      metadata: { changes },
    });
  }

  const updated = await fetchUserWithContacts(userId);
  if (!updated) {
    throw new HttpError(500, "USER_REFRESH_FAILED", "USER_REFRESH_FAILED");
  }
  return toUserDetail(updated.user, updated.contacts, updated.avatar);
}
