# 普通类单元测试

适用于普通 Java 类(工具类、工具方法等)的单元测试，是否逻辑符合预期。

## 技术栈

Mockito、JUnit 5

## 类注解配置

```java
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.STRICT_STUBS)
```

## 示例

```java
package com.szjlc.fa.search.qp.utils;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.util.Collections;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/**
 * 由AI自动生成
 */
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.STRICT_STUBS)
public class TrieCheckUtilAiTest {

    private TrieCheckUtil trieCheckUtil;

    @BeforeEach
    public void setUp() {
        trieCheckUtil = new TrieCheckUtil();
    }

    @AfterEach
    public void tearDown() {
        // 清理资源
    }

    @Test
    public void testAddWordsWithCollection_SingleWord() {
        trieCheckUtil.addWords(Collections.singletonList("test"));
        assertTrue(trieCheckUtil.isContains("test"));
    }

    @Test
    public void testAddWordsWithCollection_MultipleWords() {
        List<String> words = List.of("hello", "world", "test");
        trieCheckUtil.addWords(words);

        assertTrue(trieCheckUtil.isContains("hello"));
        assertTrue(trieCheckUtil.isContains("world"));
        assertTrue(trieCheckUtil.isContains("test"));
        assertFalse(trieCheckUtil.isContains("absent"));
    }

    @Test
    public void testAddWordsWithCollection_EmptyList() {
        trieCheckUtil.addWords(Collections.emptyList());
        assertFalse(trieCheckUtil.isContains("any"));
    }
}
```
