<script setup lang="ts">
import SubjectDialog from '@/components/subjects/SubjectDialog.vue'
import SubjectEditDialog from '@/components/subjects/SubjectEditDialog.vue'
import SubjectLibraryContent from '@/components/subjects/SubjectLibraryContent.vue'
import SubjectLibrarySidebar from '@/components/subjects/SubjectLibrarySidebar.vue'
import SubjectLibrarySplitLayout from '@/components/subjects/SubjectLibrarySplitLayout.vue'
import { useSubjectLibrary } from '@/composables/subjects/useSubjectLibrary'

const {
  visibleCategoryTree, selectedCategoryId, folderSearchKeyword, categoryLoading,
  subjects, totalCount, loading, loadingMore, hasMore, errorMessage, searchName,
  dialogVisible, createCategoryId, selectCategory, refreshLibrary, createRootCategory,
  editDialogVisible, editingSubjectId, createChildCategory, renameCategory, deleteCategory,
  openCreateDialog, handleSaved, openSubjectEditor,
  addSubjectToCanvas, renameSubject, removeSubject, loadMore,
} = useSubjectLibrary()
</script>

<template>
  <section class="subject-library-page">
    <div class="subject-library">
      <SubjectLibrarySplitLayout>
        <template #sidebar>
          <SubjectLibrarySidebar
            v-model:search-keyword="folderSearchKeyword"
            :categories="visibleCategoryTree"
            :selected-category-id="selectedCategoryId"
            :loading="categoryLoading"
            @select="selectCategory"
            @create-root="createRootCategory"
            @create-child="createChildCategory"
            @create-subject="openCreateDialog"
            @rename="renameCategory"
            @delete="deleteCategory"
            @refresh="refreshLibrary"
          />
        </template>
        <template #content>
          <SubjectLibraryContent
            v-model:search-name="searchName"
            :subjects="subjects"
            :total-count="totalCount"
            :loading="loading"
            :loading-more="loadingMore"
            :has-more="hasMore"
            :error-message="errorMessage"
            @create="openCreateDialog()"
            @edit="openSubjectEditor"
            @add-to-canvas="addSubjectToCanvas"
            @rename="renameSubject"
            @delete="removeSubject"
            @load-more="loadMore"
          />
        </template>
      </SubjectLibrarySplitLayout>
      <SubjectDialog
        v-model:visible="dialogVisible"
        :category-id="createCategoryId"
        @saved="handleSaved"
      />
      <SubjectEditDialog
        v-model:visible="editDialogVisible"
        :subject-id="editingSubjectId"
        @saved="handleSaved"
      />
    </div>
  </section>
</template>

<style scoped src="./SubjectListView.scss"></style>
